require("dotenv").config();
const axios = require("axios");

axios.get(
  "https://api.linkedin.com/v2/userinfo",
  {
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`
    }
  }
)
.then(r => console.log(r.data))
.catch(e => console.log(e.response?.data || e.message));