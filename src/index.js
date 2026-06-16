import mongoose, { connect } from 'mongoose'
import dotenv from 'dotenv'
import { DB_NAME } from './constants.js'
import connectDB from './config/db.js'
import { app } from './app.js'

//dotenv configuration
dotenv.config()

//connection to database
connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("ERR : ",error)
        throw error
    })
    app.listen(process.env.PORT||8000,()=>{
        console.log(`Server is running at port ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("MongoDB connection failed !!",error)
})





/*
import express from 'express'
const app = express()
;(async() => { 
    try{
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)  
        app.on("error",(error)=>{
            console.log("ERROR : ", error)
            throw err
        })
        app.listen(process.env.PORT,()=>{
            console.log(`Server is listening on port ${process.env.PORT}`)
        })
    }
    catch(error){
        console.log("Error : ", error)
        throw err
    }
})()
*/