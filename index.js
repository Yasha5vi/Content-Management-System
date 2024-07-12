import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import TelegramBot from "node-telegram-bot-api";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import env from "dotenv";
import GoogleStrategy from "passport-google-oauth2";
import { Strategy } from "passport-local";

const port = 3000;
const app = express();
const saltrounds = 10;
env.config();

app.use(
    session({
        secret:process.env.CMSsct,
        resave:false,
        saveUninitialized:true
    })
);

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
    user:process.env.PGuser,
    password:process.env.PGpwd,
    host:process.env.PGhost,
    port:process.env.PGport,
    database:process.env.PGdb
});

db.connect();

let loginvar;
let user_name="";
let regtext = "";

app.get("/",(req,res)=>{
    loginvar = "Login";
    const msg = regtext;
    regtext = "";
    res.render("partials/login.ejs",{
        data:loginvar,
        message:msg,
    });
});

app.get("/register",(req,res)=>{
    loginvar = "Register";
    res.render("partials/login.ejs",{
        data:loginvar,
    });
});

app.get("/dashboard",async(req,res)=>{
    try{
        const result = await db.query("SELECT * FROM sites WHERE username = $1",
            [user_name]
        );
        // console.log(result.rows);
        let info;
        if(result.rows.length>0){
            info=result.rows;
        }
        // console.log(data);
        res.render("index.ejs",{
            data:"partials/dashboard",
            heading:"Dashboard",
            user:user_name,
            sites:info
        });
    }catch(err){
        console.log(err);
    }
});
app.get("/template",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/template",
        heading:"Template",
        user:user_name
    });
});
app.get("/contact",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/contact",
        heading:"Contact Us",
        user:user_name
    });
});
app.get("/about",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/about",
        heading:"About",
        user:user_name
    });
});

let posts;
app.get("/blog",async(req,res)=>{
    try{
        const result = await db.query("SELECT * FROM posts WHERE username = $1 ORDER BY id ASC;",
            [user_name]
        );
        // console.log(result.rows);
        if(result.rows.length > 0){
            posts = true;
        }else{
            posts = false;
        }
        res.render("index.ejs",{
            data:"templates/blog",
            heading:"Create Your Blog",
            posts:posts,
            dbdata:result.rows,
            user:user_name
        });
    }catch(err){
        console.log(err);
    }
});

app.get("/post",(reqs,res)=>{
    res.render("index.ejs",{
        data:"templates/post",
        heading:"Add a Post",
        user:user_name
    });
});

app.post(
    "/login",
    passport.authenticate("local",{
    // console.log(req.body);
        successRedirect:"/dashboard",
        failureRedirect:"/"
    })
);

passport.use(
    "local",
    new Strategy(async function verify(username,password,cb){
        try{
            // console.log("here");
            const result = await db.query("SELECT * FROM login WHERE email = $1",
                [username]
            );//this username is actually email from the form 
            
            if(result.rows.length > 0){
                const user = result.rows[0];
                const storedHash = user.pwd;
    
                bcrypt.compare(password,storedHash,async(err,valid)=>{
                    if(err){
                        // console.log("error");
                        return cb(err);
                    }else{
                        if(valid){
                            user_name = user.username;
                            //login pe agr last session me posts 
                            //me kuch data rhe gya ho tho 
                            console.log(user_name);
                            await db.query("DELETE FROM posts WHERE username = $1;",
                                [user_name]
                            );
                            // console.log("here");
                            return cb(null,user);
                        }else{
                            // console.log("false case");
                            regtext="Incorrect Password";
                            return cb(null,false);
                        }
                    }
                });   
            }else{
                regtext="User not found please register";
                return cb(null,false);
            }
        }catch(err){
            console.log(err);
        }
    })
);

app.post("/register",async(req,res)=>{
    // console.log(req.body);
    try{
        const result = await db.query("SELECT * FROM login WHERE email = $1;",
            [req.body.email]
        );
        // console.log(result.rows);
        if(result.rows.length > 0){
            loginvar="Login";
            res.render("partials/login.ejs",{
                data:loginvar,
                message:"User already exists please Login"
            });
        }else{
            bcrypt.hash(req.body.password,saltrounds,async(err,hash)=>{
                if(err){
                    console.log(err);
                }else{
                    await db.query("INSERT INTO login (username,email,pwd) VALUES ($1,$2,$3);",
                        [req.body.username,req.body.email,hash]
                    );
                    const msg = "Registered please login";
                    loginvar = "Login";
                    res.render("partials/login.ejs",{
                        data:loginvar,
                        message:msg
                    });
                }
            });    
        }
    }catch(err){
        console.log(err);
    }
});

app.post("/insert",async(req,res)=>{
    // console.log(req.body);
    const src = req.body.postSource;
    const title = req.body.title;
    const para = req.body.para;
    const author = req.body.author;
    try{
        // console.log(username);
        if(src === "add"){
            await db.query("INSERT INTO posts (username,title,para,author) VALUES($1,$2,$3,$4);",
                [user_name,title,para,author]
            );
        }else{
            // console.log(src);
            await db.query("UPDATE posts SET title=$1,para=$2,author=$3 WHERE id = $4",
                [title,para,author,src]
            );
        }
    }catch(err){
        console.log(err);
    }
    res.redirect("/blog");
});

app.post("/update",async(req,res)=>{
    console.log(req.body);
    try{
        if("edit" in req.body){
            const result = await db.query("SELECT * FROM posts WHERE id = $1;",
                [req.body.edit]
            );
            console.log(result.rows[0]);
            res.render("index.ejs",{
                heading:"Edit Post",
                data:"templates/post",
                content:result.rows[0],
                user:user_name
            });
        }else{
            console.log(req.body.delete);
            await db.query("DELETE FROM posts WHERE id = $1;",
                [req.body.delete]
            );
            res.redirect("/blog");
        } 
    }catch(err){
        console.log(err);
    }
});

app.post("/host",async(req,res)=>{
    try{
        // console.log(username);
        const result = await db.query("SELECT * FROM posts WHERE username = $1",
            [user_name]
        );
        const info = result.rows;

        const data = await db.query("SELECT * FROM sites ORDER BY siteid DESC");
        let siteId = 0;
        if(data.rows.length > 0){
            siteId = data.rows[0].siteid+1;
        }
        
        // console.log(info);
        // console.log(siteId);
        // console.log(username);

        if(info.length > 0){
            // sitedata me insert kra diya
            info.forEach(async(post)=>{
                try{
                    await db.query("INSERT INTO sitedata (siteid,username,title,para,author) VALUES($1,$2,$3,$4,$5);",
                        [siteId,user_name,post.title,post.para,post.author]
                    );
                }catch(err){
                    console.log(err);
                }
            });
            // site me insert kra diya
            await db.query("INSERT INTO sites (username,siteid) VALUES($1,$2)",
                [user_name,siteId]
            );
            // posts se data nikal diya
            await db.query("DELETE FROM posts WHERE username = $1",
                [user_name]
            );
            res.redirect("/dashboard");
        }else{
            res.render("index.ejs",{
                data:"templates/blog",
                heading:"Create Your Blog",
                posts:posts,
                user:user_name,
                mesg:"Nothing to host"
            });
        }
    }catch(err){
        console.log(err);
    }
});

app.post("/dashupdate",async(req,res)=>{
    console.log(req.body);
    if("delete" in req.body){
        try{
            await db.query("DELETE FROM sites WHERE siteid = $1;",
                [req.body.delete]
            );
            await db.query("DELETE FROM sitedata WHERE siteid = $1;",
                [req.body.delete]
            );
            res.redirect("/dashboard");
        }catch(err){
            console.log(err);
        }
    }else if("edit" in req.body){
        // console.log(username);
        try{
            await db.query("DELETE FROM sites where siteid = $1;",
                [req.body.edit]
            );
            const data = await db.query("SELECT * FROM sitedata WHERE siteid = $1;",
                [req.body.edit]
            );
            await db.query("DELETE FROM sitedata WHERE siteid = $1;",[req.body.edit]);
            // console.log(data.rows);
            data.rows.forEach(async(post)=>{
                try{
                    await db.query("INSERT INTO posts (username,title,para,author) VALUES ($1,$2,$3,$4);",
                        [post.username,post.title,post.para,post.author]
                    );
                    res.redirect("/blog");
                }catch(err){
                    console.log(err);
                }
            })
        }catch(err){
            console.log(err);
        }
    }
});

app.post("/sendinfo",(req,res)=>{
    // console.log(req.body);
    const {name,email,message} = req.body;
    // console.log(email);
    // console.log(message);
    const token = process.env.Token;
    const chatid = process.env.ChatId;
    const bot = new TelegramBot(token, { polling: true });
    const telegramMessage = `
        New Contact Form Submission:
        Name: ${name}
        Email: ${email}
        Message: ${message}
    `;

    // Send the message to the specified chat ID
    bot.sendMessage(chatid, telegramMessage)
    .then(() => {
        res.render("index.ejs",{
            data:"partials/contact",
            heading:"Contact Us",
            user:user_name,
            retext:"Message Sent"
        });
    })
    .catch((error) => {
        res.status(500).send(error.toString());
    });
});

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
});
