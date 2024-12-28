import sendEmail from "../config/sendEmail.js";
import UserModel from "../models/user.model.js";
import bcryptjs from "bcryptjs"
import verifyEmailTemplate from "../utils/verifyEmailTemplate.js";
import generatedAccessToken from "../utils/generatedAccessToken.js";
import generatedRefreshToken from "../utils/generatedRefreshToken.js";
import uploadImageCloudinary from "../utils/uploadImageCloudinary.js";
import generateOtp from "../utils/generateOtp.js";
import forgotPasswordTemplate from "../utils/forgotPasswordTemplate.js";
import jwt from"jsonwebtoken"


// register controller
export async function registerUserController(req,res){
    try {
        const {name,email,password} = req.body
 
        if(!name || !email || !password){
            return res.status(400).json({
                message: "Provide email, name and password",
                error: true,
                success: false
            })
        }

        const user = await UserModel.findOne({email})
        if(user){
            return res.status(400).json({
                message:"Already registered Email",
                error:true,
                success:false
            })
        } 

        const salt = await bcryptjs.genSalt(10)
        const hashPassword = await bcryptjs.hash(password,salt)

        const payload={
            name,
            email,
            password:hashPassword
        }
        
        const newUser = new UserModel(payload)
        const save = await newUser.save()

        const verifyEmailUrl= `${process.env.FRONTEND_URL}/verify-email?code=${save?._id}`

        const verifyEmail = await sendEmail({
            sendTo: email,
            subject: "Verify your email for binkeyIt",
            html: verifyEmailTemplate({
                name,
                url: verifyEmailUrl
            })
        })

        return res.json({
            message: "User registered successfully ",
            error: false,
            success: true,
            data: save
        })


    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }

}

// verify email controller
export async function verifyEmailController(req,res){
    try {
        const {code} = req.body

        const user = await UserModel.findOne({_id:code})

        if(!user){
            return res.status(500).json({
                message:"Invalid code",
                error:true,
                success:false
         })
        }

        const updateUser = await UserModel.updateOne({_id:code},{
            verify_email:true
        })

        return res.json({
            message:"Verfication done",
            success:true,
            error:false
        })
    } catch (error) {
        return res.status(500).json({
            message:error.message ||error,
            error:true,
            success:false
        })
    }
}

// login controller
export async function loginController(req,res){
    try{
         const  {email, password} = req.body

         if(!email || !password){
            return res.status(400).json({
                message: "provide email, password",
                error: true,
                success: false
            })
         }

         const user = await UserModel.findOne({email})

         if(!user){
            return res.status(400).json({
                message: "User not registered",
                error: true,
                success: false
            })
         }

         if(user.status !=="Active"){
            return res.status(400).json({
                message: "Contact to Admin",
                error: true,
                success: false 

            })
         }

         const checkPassword = await bcryptjs.compare(password, user.password)

         if(!checkPassword){
            return res.status(400).json({
                message: "check your password",
                error: true,
                success: false
            })
         }

         const accessToken = await generatedAccessToken(user._id)
         const refreshToken = await generatedRefreshToken(user._id)

         const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: "None"
         }
         res.cookie('accessToken',accessToken,cookiesOption)
         res.cookie('refreshToken',refreshToken,cookiesOption)

         return res.json({
            message: "Login successful",
            error: false,
            success: true,
            data: {
                accessToken,
                refreshToken
            }
         })


    }catch(error){
        return res.status(500).json({
        message: error.message || error,
        error: true,
        success: false
        })
    }
}

// logout controller
export async function logoutContoller(req, res){
    try {
        const userid = req.userId  // middleware

         const cookiesOption = {
            httpOnly : true,
            secure : true,
            sameSite : "None"
        }

        res.clearCookie("accessToken",cookiesOption)
        res.clearCookie("refreshToken",cookiesOption)

         const removeRefreshToken = await UserModel.findByIdAndUpdate(userid,{
           refresh_token: "" 
         })

        return res.json({
            message: "Logout Successful",
            error: false,
            success: true
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true, 
            success: true
        })
    }
}

// upload user avatar
export async function uploadAvatar(req, res){
    try{

        const userId = req.userId // auth middleware
        const image = req.file // multer middleware

        const upload = await uploadImageCloudinary(image)

        const updateUser = await UserModel.findByIdAndUpdate(userId,{
            avatar: upload.url
        })

        return res.json({
            message: "upload profile",
            data:{
                _id: userId,
                avatar: upload.url
            },
            error: false,
            success:true
        })
    } catch(error){
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// update user details
export async function updateUserDetails(req,res){
    try {
        const userId = req.userId // auth middleware
        const {name,email, mobile, password} = req.body

        let hashPassword = ""
        if(password) {
            const salt = await bcryptjs.genSalt(10)
            hashPassword = await bcryptjs.hash(password,salt)
        }

        const updateUser = await UserModel.updateOne({_id : userId},{
            ...(name &&{name: name}),
            ...(email && {email:email}),
            ...(mobile && {mobile: mobile}),
            ...(password && {password: hashPassword})
        })

        return res.json({
            message: "updated user successfully",
            error: false,
            success: true,
            data: updateUser
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// forgot password not login
export async function forgotPasswordController(req,res){
    try {
        const {email} = req.body

        const user = await UserModel.findOne({email})

        if(!user){
            return res.status(400).json({
                message: "Email not found",
                error:true,
                success: false
            })
        }

        const otp = generateOtp()
        const expireTime = new Date() + 60*60*1000

        const update = await UserModel.findByIdAndUpdate(user._id,{
            forgot_password_otp: otp,
            forgot_password_expiry: new Date(expireTime).toISOString()
        })

         await sendEmail({
            sendTo: email,
            subject: "forgot password from BinkeyIt",
            html: forgotPasswordTemplate({name:user.name,otp:otp})
        })

        return res.json({
            message: "check your email",
            error: false,
            success: true
        })

       
    } catch (error) {
        res.status(500).json({
            message: error.message || error,
            error: true,
            success:false
        })
    }
}

// verify forgot password otp
export async function verifyForgotPasswordOtp(req,res){
    try {
      const {email,otp} = req.body

      if(!email || !otp){
        return res.status(400).json({
            message: "Provide required field Email, OTP",
            error: true,
            success:false
        })
      }

      const user = await UserModel.findOne({email})

        if(!user){
            return res.status(400).json({
                message: "Email not found",
                error:true,
                success: false
            })
        }

        const currentTime = new Date().toISOString

        if(user.forgot_password_expiry<currentTime){
           return res.status(400).json({
                message:"OTP is expired",
                error: true,
                success: false
            })
        }

        if(otp !== user.forgot_password_otp){
          return res.status(400).json({
            message: "Invalid OTP",
            error: true,
            success: false
          })
        }

        // if otp is not expired
        // otp === user.forgot_password_otp

        return res.status(200).json({
            message: "otp verification successful",
            error: false,
            success: true
        })


    } catch (error) {
        return res.status(500).json({
            message: error || error.message,
            error: true,
            success: false
        })
    }
}

// reset the password
export async function resetPassword(req,res) {
    try {
        const {email, newPassword, confirmPassword} = req.body

        if (!email || !newPassword || !confirmPassword){
            return res.json(400).json({
                message: "Provide required fields Email, New password and Confirm password",
                error:true, 
                success:false
            })
        }

        const user = await UserModel.findOne({email})

        if(!user){
            return res.status(400).json({
                message: "Email not avaiable",
                error: true,
                success:false
            })
        }

        if (newPassword !== confirmPassword){
            return res.status(400).json({
                message: "new password and confirm password fields don't match",
                error: true,
                success:false
            })
        }

        const salt = await bcryptjs.genSalt(10)
        const hashPassword = await bcryptjs.hash(newPassword,salt)

        const update = await UserModel.findOneAndUpdate(user._id,{
            password: hashPassword
        })

        return res.json({
            message: "password updated successfully",
            error:false,
            success:true
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success:false
        })
    }
    
}

// refresh token controller
export async function refreshToken(req,res){
    try {
        const refreshToken = req.cookies.refreshToken || req?.header?.authorization?.split(" ")[1] // second one for the bearer token in app version 

        if(!refreshToken){
            return res.status(400).json({
                message: "Invalid Token",
                error:true,
                success:false
            })
        }

        const verifyToken = await jwt.verify(refreshToken,process.env.SECRET_KEY_REFRESH_TOKEN)

        if(!verifyToken){
            return res.status(400).json({
                message: "token is expired",
                error:true,
                success:false
            })
        }
        
        const userId = verifyToken?.id

        const newAccessToken = await generatedAccessToken(userId)

        const cookiesOption={
            httpOnly:true,
            secure:true,
            sameSite:"None"
        }

        res.cookie('accessToken',newAccessToken,cookiesOption)

        return res.json({
            message:"New Access Token generated",
            error:false,
            success:true,
            data:{
                accessToken: newAccessToken
            }
        })


    } catch (error) {
        return res.status(500).json({
            message: error.message|| error,
            success:false,
            error:true
        })
    }
}