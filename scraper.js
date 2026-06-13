const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');

async function scrapeAndSave() {
  // 1. Connect to your Neon Database using the secret environment variable
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure cloud database connections
  });
  
  try {
    await client.connect();
    console.log("Connected to Neon Database successfully!");

    // 2. Fetch HTML from the news site (Example: Hacker News)
    const { data } = await axios.get('https://news.ycombinator.com/');
    const $ = cheerio.load(data);
    
    const articles = [];

    // 3. Parse the HTML for the top 10 articles
    // In Hacker News, every article title sits inside a span with the class ".titleline"
    $('.titleline > a').each((index, element) => {
      if (articles.length < 10) {
        articles.push({
          title: $(element).text(),
          url: $(element).attr('href')
        });
      }
    });

    console.log(`Successfully scraped ${articles.length} headlines. Syncing with database...`);

    // 4. Clean out the old 10 rows so your database always holds the fresh 10 items
    await client.query('TRUNCATE TABLE news;');

    // 5. Insert the new 10 articles into the database
    const insertQuery = 'INSERT INTO news (title, url) VALUES ($1, $2) ON CONFLICT (url) DO NOTHING;';
    for (const article of articles) {
      await client.query(insertQuery, [article.title, article.url]);
    }

    console.log("Database updated successfully with the latest 10 news items!");

  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    await client.end();
  }
}

scrapeAndSave();
