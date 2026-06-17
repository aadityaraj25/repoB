import { Router } from "express"
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controllers.js"
import { upload } from '../middlewares/multer.middleware.js'
import { VerifyJWT } from '../middlewares/auth.middleware.js'

const router = Router()


// const route = Router()
// route.post("/add",createTodo)
// route.get("/",getTodo)
// route.get("/:id",getTodobyID)
// route.put("/:id",updateTodo)
// route.patch("/:id/toggle",toggleTodobyId)
// route.delete("/:id",deleteTodo) 

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1,
        },
        {
            name:"coverImage",
            maxCount:1,
        }
    ]),
registerUser) 

router.route("/login").post(loginUser)

// secured routes
// router.route("/logout").post(VerifyJWT,logoutUser)
router.post("/logout",VerifyJWT,logoutUser)
router.post("/refreshToken",refreshAccessToken)

export default router 