import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiErrors.js" 
import { User } from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { upload } from "../middlewares/multer.middleware.js"
import { ApiResponse } from "../utils/apiResponse.js"
import jwt from 'jsonwebtoken'


const generateRefreshAndAccessToken = async(userId) => {
    try{
        const user = await User.findById(userId) 
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave:false })

        return {accessToken, refreshToken}

    }
    catch(error){
        throw new ApiError(500,"Something went wrong while  ge nerating Access and Refresh token")
    }
}


const registerUser = asyncHandler(async(req,res)=>{
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
    
    const {fullName,email,username,password} = req.body
    // console.log("email : ",email)

    // if(fullName==="") throw new ApiError(4000,"full name is required")

    if(
        [fullName,email,username,password].some((field) => field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }

    const existingUser = await User.findOne({
        $or: [ { username } ,{ email } ]
    })

    if(existingUser){
        throw new ApiError(400,"User with email or username already exist")
    }

    // console.log("req files: ",req.files) --- debugging purpose only
    // handle files like avatar image and coverImage
    // multer gives access to req.files
    // avatar image
    const avatarLocalPath = req.files?.avatar[0]?.path
    console.log(avatarLocalPath)

    // cover Image
    const coverLocalPath = req.files?.coverImage?.[0]?.path
    console.log(coverLocalPath)

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverLocalPath) -- vulnurable if cover image is not present
    const coverImage = coverLocalPath?await uploadOnCloudinary(coverLocalPath) : null

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user =  await User.create({
        fullName,
        avatar: avatar.secure_url,
        coverImage: coverImage?.secure_url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
 
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while reggistering the user")
    }

    return res.status(201).json(
        new ApiResponse(201,createdUser,"User Created Successfullly")
    )

})

const loginUser = asyncHandler( async(req,res)=>{
    // req.body ->data
    // check for empty fields
    // username or email and password
    // find the user
    // validate from the database
    // access and refresh token generation
    // send cookie
    const {email,username,password} = req.body
    if(!(username || email)){
        throw new ApiError(400,"Username or Email is required")
    }

    // if used either username or email then
    const user = await User.findOne({
        $or: [{username},{email}]
    })

    // const user = await User.findOne({username})
    if(!user){
        throw new ApiError(404, "User does not Exist")
    }

    const isValid = await user.isPasswordCorrect(password)
    if(!isValid){
        throw new ApiError(401, "Invalid User Credentials")
    }

    const { accessToken, refreshToken } = await generateRefreshAndAccessToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send this data through cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
              .status(200)
              .cookie("accessToken",accessToken,options)
              .cookie("refreshToken",refreshToken,options)
              .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser, 
                        accessToken,
                        refreshToken
                    },
                    "User logged In Successfully",
                )
              )
})

const logoutUser = asyncHandler( async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined,
            }
        },
        {
            new:true,
        }
    )

    const options={
        httpOnly: true,
        secure:true,
    }

    return res
             .status(200)
             .clearCookie("accessToken",options)
             .clearCookie("refreshToken",options)
             .json(new ApiResponse(200,{},"User logged out Successfully"))
})

const refreshAccessToken = asyncHandler( async(req,res) => {
    try {
        console.log(req.cookies)
        const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if(!incommingRefreshToken){
            throw new ApiError(401,"Unauthorized request")
        }
    
        // other method
        // const token = await User.findOne({ incommingRefreshToken })
        // if(!token){
        //     throw new ApiError(404,"Invalid Request")
        // }
    
        const decodedToken = jwt.verify(
            incommingRefreshToken,
            process.env.ACCESS_TOKEN_SECRET,
        )
        if(!decodedToken){
            throw new ApiError(404,"Invalid Request")
        }
        
        const user = await User.findOne(decodedToken._id)
        if(!user){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        // validation
        if(incommingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Invalid Refresh Token")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const generatedTokens = await generateRefreshAndAccessToken(user._id)
        
        return res
                  .status(200)
                  .cookie("accessToken",generatedTokens.accessToken,options)
                  .cookie("refreshToken",generatedTokens.refreshToken,options)
                  .json(
                    new ApiResponse(
                        200,
                        {
                            accessToken: generatedTokens.accessToken,
                            refreshToken: generatedTokens.refreshToken,
                        },
                        "Access Token Refreshed Successfully"
                    )
                  )
    } catch (error) {
        new ApiError(
            401,
            erorr?.message || "Invalid Refresh Tokens"
        )
    }
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
}