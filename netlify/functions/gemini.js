exports.handler = async function(event) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const body = JSON.parse(event.body);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  return {
    statusCode:200,
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify(data)
  };

};
