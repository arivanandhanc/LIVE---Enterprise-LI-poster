const axios = require("axios");
require("dotenv").config();

async function test() {
  try {
    const res = await axios.post(
      "https://api.linkedin.com/rest/posts", 
      {
        author: "urn:li:person:HLC2iMVLi2",
        commentary: "LinkedIn API test post",
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202506" // Updated active version (YYYYMM format)
        }
      }
    );

    console.log("Post successful!");
    // LinkedIn returns an HTTP 201 status code on success
    console.log("Response Status:", res.status);
    console.log("Post URN Identifier:", res.headers["x-linkedin-id"]);
  } catch (e) {
    console.error("Error occurred:");
    console.error(e.response?.data || e.message);
  }
}

test();
