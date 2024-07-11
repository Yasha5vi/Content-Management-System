import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import TelegramBot from "node-telegram-bot-api";
import bcrypt from "bcrypt";

const port = 3000;
const app = express();
const saltrounds = 10;

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

const db = new pg.Client({
    user:"postgres",
    password:"friday123",
    host:"localhost",
    port:5432,
    database:"CMS"
});

db.connect();

let loginvar;

app.get("/",(req,res)=>{
    loginvar = "Login";
    res.render("partials/login.ejs",{
        data:loginvar,
    });
});

app.get("/register",(req,res)=>{
    loginvar = "Register";
    res.render("partials/login.ejs",{
        data:loginvar
    });
});
let username="yashasvi03";
app.post("/login",async(req,res)=>{
    // console.log(req.body);
    try{
        const result = await db.query("SELECT * FROM login WHERE email = $1",
            [req.body.email]
        );
        if(result.rows.length > 0){
            const storedHash = result.rows[0].pwd;

            bcrypt.compare(req.body.password,storedHash,async(err,allowed)=>{
                if(err){
                    console.log(err);
                }else{
                    if(allowed){
                        username = result.rows[0].username;
                        const sitedata = await db.query("SELECT * FROM sites WHERE username = $1",
                            [username]
                        );
                        // console.log(sitedata.rows);
                        let info;
                        if(sitedata.rows.length>0){
                            info=sitedata.rows;
                        }
                        // console.log(username);
                        // console.log(info);
                        //login pe agr last session me posts me kuch data rhe gya ho tho
                        await db.query("DELETE FROM posts WHERE username = $1;",
                            [username]
                        );
                        res.render("index.ejs",{
                            data:"partials/dashboard",
                            heading:"Dashboard",
                            user:username,
                            sites:info
                        }); 
                    }else{
                        loginvar="Login";
                        res.render("partials/login.ejs",{
                            message:"Incorrect password",
                            data:loginvar
                        });
                    }
                }
            });   
        }else{
            loginvar="Login";
            res.render("partials/login.ejs",{
                message:"User not found Please register",
                data:loginvar
            });
        }
    }catch(err){
        console.log(err);
    }
});

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

app.get("/dashboard",async(req,res)=>{
    try{
        const result = await db.query("SELECT * FROM sites");
        // console.log(result.rows);
        let data;
        if(result.rows.length>0){
            data=result.rows;
        }
        // console.log(data);
        res.render("index.ejs",{
            data:"partials/dashboard",
            heading:"Dashboard",
            user:username,
            sites:data
        });
    }catch(err){
        console.log(err);
    }
});
app.get("/template",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/template",
        heading:"Template",
        user:username
    });
});
app.get("/contact",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/contact",
        heading:"Contact Us",
        user:username
    });
});
app.get("/about",(req,res)=>{
    res.render("index.ejs",{
        data:"partials/about",
        heading:"About",
        user:username
    });
});

let posts;
app.get("/blog",async(req,res)=>{
    try{
        const result = await db.query("SELECT * FROM posts WHERE username = $1 ORDER BY id ASC;",
            [username]
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
            user:username
        });
    }catch(err){
        // res.render("index.ejs",{
        //     data:"templates/blog",
        //     heading:"Create Your Blog",
        //     posts:posts,
        //     user:username
        // });
        console.log(err);
    }
});

app.get("/post",(reqs,res)=>{
    res.render("index.ejs",{
        data:"templates/post",
        heading:"Add a Post",
        user:username
    });
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
                [username,title,para,author]
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
                user:username
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
            [username]
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
                        [siteId,username,post.title,post.para,post.author]
                    );
                }catch(err){
                    console.log(err);
                }
            });
            // site me insert kra diya
            await db.query("INSERT INTO sites (username,siteid) VALUES($1,$2)",
                [username,siteId]
            );
            // posts se data nikal diya
            await db.query("DELETE FROM posts WHERE username = $1",
                [username]
            );
            res.redirect("/dashboard");
        }else{
            res.render("index.ejs",{
                data:"templates/blog",
                heading:"Create Your Blog",
                posts:posts,
                user:username,
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
    const token = "xxxxxxxxxxxxxxxxxxxx";
    const chatid = 123456789;
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
                user:username,
                retext:"Message Sent"
            });
        })
        .catch((error) => {
            res.status(500).send(error.toString());
        });
});

app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
});
