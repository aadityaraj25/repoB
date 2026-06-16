import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiErrors.js" 
import { User } from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { upload } from "../middlewares/multer.middleware.js"
import { ApiResponse } from "../utils/apiResponse.js"


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

export {registerUser}