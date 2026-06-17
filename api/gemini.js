export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).send("Method Not Allowed");
}

const GEMINI_KEY=process.env.GEMINI_API_KEY;

try{

const response=await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(req.body)
}
);

const data=await response.json();

return res.status(200).json(data);

}catch(error){

return res.status(500).json({
error:error.message
});

}

}
