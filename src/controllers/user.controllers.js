import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { upload } from "../middlewares/multer.middleware.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { AsyncLocalStorage } from "async_hooks";

const generateRefreshAndAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while  ge nerating Access and Refresh token",
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user detail from frontend
  // validation - not empty
  // check if user already exist: username or email
  // check for images, check for avatar
  // upload them to avatar, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response -- if user is created or not

  // console.log("req.body : ",req.body) --- debugging purpose only

  const { fullName, email, username, password } = req.body;
  // console.log("email : ",email)

  // if(fullName==="") throw new ApiError(4000,"full name is required")

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(400, "User with email or username already exist");
  }

  // console.log("req files: ",req.files) --- debugging purpose only
  // handle files like avatar image and coverImage
  // multer gives access to req.files
  // avatar image
  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log(avatarLocalPath);

  // cover Image
  const coverLocalPath = req.files?.coverImage?.[0]?.path;
  console.log(coverLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // const coverImage = await uploadOnCloudinary(coverLocalPath) -- vulnurable if cover image is not present
  const coverImage = coverLocalPath
    ? await uploadOnCloudinary(coverLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while reggistering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User Created Successfullly"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body ->data
  // check for empty fields
  // username or email and password
  // find the user
  // validate from the database
  // access and refresh token generation
  // send cookie
  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "Username or Email is required");
  }

  // if used either username or email then
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  // const user = await User.findOne({username})
  if (!user) {
    throw new ApiError(404, "User does not Exist");
  }

  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    throw new ApiError(401, "Invalid User Credentials");
  }

  const { accessToken, refreshToken } = await generateRefreshAndAccessToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  // send this data through cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    console.log(req.cookies);
    const incommingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;
    if (!incommingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    // other method
    // const token = await User.findOne({ incommingRefreshToken })
    // if(!token){
    //     throw new ApiError(404,"Invalid Request")
    // }

    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.ACCESS_TOKEN_SECRET,
    );
    if (!decodedToken) {
      throw new ApiError(404, "Invalid Request");
    }

    const user = await User.findOne(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Refresh Token is expired or used");
    }

    // validation
    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const generatedTokens = await generateRefreshAndAccessToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", generatedTokens.accessToken, options)
      .cookie("refreshToken", generatedTokens.refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: generatedTokens.accessToken,
            refreshToken: generatedTokens.refreshToken,
          },
          "Access Token Refreshed Successfully",
        ),
      );
  } catch (error) {
    new ApiError(401, erorr?.message || "Invalid Refresh Tokens");
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Password changed"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User Fetched Successfully"));
});

// for file updation, handle it seperately
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!(fullName || email)) {
    throw new ApiError(404, "All fields are required");
  }

  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email, // both syntax are correct
      },
    },
    { new: true }, //returns the updated infromation
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Account details updated successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  // not files bcz there is only single image
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.secure_url) {
    throw new ApiError(400, "Error while updating Avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.secure_url,
      },
    },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar is updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  // not files bcz there is only single image
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.secure_url) {
    throw new ApiError(400, "Error while updating Cover Image");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.secure_url,
      },
    },
    { new: true },
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image is updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: username?.toLowerCase(),
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subsribersCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subsribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User Channel fetched Successfully"),
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from: "users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  }
                }
              ]
            }
          },
          {
            $addField:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200)
            .json(new ApiResponse(200,user[0].watchHistory,"Watch Hisrtory fetched Successfully"))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
