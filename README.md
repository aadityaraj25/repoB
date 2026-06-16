**Multer Memory Storage**

//diskStorage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/my-uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + {Date.now()})
  }
})

//bufferStorage
const storage = multer.memoryStorage()

const upload = multer({ storage: storage })

