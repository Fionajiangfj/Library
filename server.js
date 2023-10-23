const express = require("express");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;
const path = require("path");

app.use(express.static("assets"));

// json responce
app.use(express.json());

// import handlebars
const { engine } = require("express-handlebars");
app.engine(".hbs", engine({ extname: ".hbs" }));
app.set("views", "./views");
app.set("view engine", ".hbs");

// decode form data
app.use(express.urlencoded({ extended: true }));

// configure session
const session = require("express-session");
app.use(
    session({
        secret: "terrace cat",
        resave: false,
        saveUninitialized: true,
        // cookie: { secure: true },
    })
);

// Database
const mongoose = require("mongoose");

const CONNECTION_STRING =
    "mongodb+srv://jiang6073:TH4LcEXzbgZzU1xC@cluster0.ctn43sl.mongodb.net/library?retryWrites=true&w=majority";

mongoose.connect(CONNECTION_STRING);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Error connecting to database: "));
db.once("open", () => {
    console.log("Mongo DB connected successfully.");
});

// ----------------
// schema
const Schema = mongoose.Schema;
const BookSchema = new Schema({
    title: String,
    author: String,
    image: String,
    borrowedBy: String,
});
const UserSchema = new Schema({
    name: String,
    libraryCardNumber: String,
    phoneNumber: String,
});

// models
const Book = mongoose.model("book_collection", BookSchema);
const User = mongoose.model("user_collection", UserSchema);

// ------------------------------------------
// middleware
const ensureLogin = (req, res, next) => {

    if (req.session.user) {
        next()
    } else {
        return res.render("login", {
            layout: "layout.hbs",
            msg: "Please login first",
        })
    }
}

// ------------------------------------------

// ------------------------------------------
app.get("/", async (req, res) => {
    try {
        const bookList = await Book.find().lean().exec();
        return res.render("home", {
            layout: "layout.hbs",
            bookList: bookList,
        });
    } catch (err) {
        return res.render("error", {
            layout: "layout.hbs",
            msg: `There is something wrong. ERROR: ${err}`,
        });
    }
});

app.get("/borrow/:id", ensureLogin, async (req, res) => {

    const bookIDFromParams = req.params.id;
    if (!bookIDFromParams) {
        return res.send(`There seems to be something wrong.`)
        // return res.send("The book is unavailable, please try later.");
    }

    // find book find database
    try {
        const bookToBorrow = await Book.findOne({_id: bookIDFromParams})
        console.log(bookToBorrow);

        const currUser = await User.findOne({libraryCardNumber: req.session.user.libraryCardNumber})
        console.log(currUser);

        await bookToBorrow.updateOne({borrowedBy: currUser.libraryCardNumber})

        return res.redirect('/profile')
    } catch (err) {
        return res.render("error", {
            layout: "layout.hbs",
            msg: `There is something wrong. ERROR: ${err}`,
        });
    }
});

app.get("/return/:id", ensureLogin, async (req, res) => {

    const bookIDFromParams = req.params.id;
    if (!bookIDFromParams) {
        return res.send(`There seems to be something wrong.`)
        // return res.send("The book is unavailable, please try later.");
    }

    // find book find database
    try {
        const bookToReturn = await Book.findOne({_id: bookIDFromParams})
        console.log(bookToReturn);

        await bookToReturn.updateOne({borrowedBy: ""})

        return res.redirect('/profile')
        
    } catch (err) {
        return res.render("error", {
            layout: "layout.hbs",
            msg: `There is something wrong. ERROR: ${err}`,
        });
    }
})

app.get("/profile", ensureLogin, async (req, res) => {

    try {
        const cardNum = req.session.user.libraryCardNumber;
        const borrowedBooks = await Book.find({borrowedBy: cardNum}).lean().exec()

        return res.render("profile", {
            layout: "layout.hbs",
            currUser: req.session.user,
            borrowedBooks: borrowedBooks,
        })
    } catch (err) {
        return res.render("error", {
            layout: "layout.hbs",
            msg: `There is something wrong. ERROR: ${err}`,
        });
    }
    
})

app.get("/login", (req, res) => {
    return res.render("login", {
        layout: "layout.hbs",
    });
});

app.post("/login", async (req, res) => {
    const cardNumFromUI = req.body.cardNum;
    const passwordFromUI = req.body.password;

    // check for undefined, null, ""
    if (!cardNumFromUI || !passwordFromUI) {
        return res.render("login", {
            layout: "layout.hbs",
            msg: "Both Library Card Number and password have to be provided.",
        });
    }

    // check user from database
    try {
        const currUser = await User.findOne(
            ({ libraryCardNumber: cardNumFromUI })
        ).lean();
        if (!currUser) {
            return res.render("login", {
                layout: "layout.hbs",
                msg: "Card number doesn't exist, please try again.",
            });
        }

        const phoneNumFromDB = currUser.phoneNumber;
        let password = "";
        for (let i = 0; i < phoneNumFromDB.length; i++) {
            if (i >= 8) {
                password += phoneNumFromDB[i];
            }
        }
        if (passwordFromUI !== password) {
            return res.render("login", {
                layout: "layout.hbs",
                msg: "The password is incorrect, please try again.",
            });
        }

        // if valid user
        req.session.user = {
            name: currUser.name,
            libraryCardNumber: currUser.libraryCardNumber,
            phoneNumber: currUser.phoneNumber,
            password: password,
        };
        return res.redirect("/profile");

    } catch (err) {
        return res.render("error", {
            layout: "layout.hbs",
            msg: `There is something wrong. ERROR: ${err}`,
        });
    }
});

app.get("/logout", (req, res) => {
    // if no user is logged in
    if (!req.session.user) {
        return res.render("login", {
            layout: "layout.hbs",
            msg: `ERROR: No users logged in.`,
        });
    }

    req.session.destroy()
    res.redirect("/login")
})

// ------------------------------------------
const onHttpStart = () => {
    console.log(`The web server has started at http://localhost:${HTTP_PORT}`);
    console.log("Press CTRL+C to stop the server.");
};
app.listen(HTTP_PORT, onHttpStart);
