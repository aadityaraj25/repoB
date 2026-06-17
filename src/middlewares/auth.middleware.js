import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken'


// if req or res is not in use we can replace it with '_'
export const VerifyJWT = asyncHandler( async(req,res,next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
    
        if(!token){
            throw new ApiError(401,"Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            throw new ApiError(401,"Invalid Access Token")
        }
     
        req.user = user //custom req header
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }
} ) 