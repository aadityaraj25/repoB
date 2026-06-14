import mongoose, { connect } from 'mongoose'
import dotenv from 'dotenv'
import { DB_NAME } from './constants.js'
import connectDB from '../config/db.js'

//dotenv configuration
dotenv.config()

//connection to database
connectDB()

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