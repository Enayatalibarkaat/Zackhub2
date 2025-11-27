import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async (event, context) => {
  const headers = {
    "Content-Type": "application/xml",
    // 1 ghante (3600 sec) tak cache rakho taaki database par load na pade
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200"
  };

  try {
    await connect();
    
    // Sirf Title aur Date chahiye, baki data mat mangwao (Speed badhane ke liye)
    const movies = await Movie.find({}, 'title updatedAt createdAt').sort({ createdAt: -1 }).lean();

    // XML ka Header (Shuruwat)
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://zackhub.in/</loc>
    <priority>1.00</priority>
    <changefreq>daily</changefreq>
  </url>`;

    // Har Movie ke liye Loop chalao
    movies.forEach(movie => {
      // Slug Formula (Same as frontend)
      const slug = movie.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Date format karna (agar available ho)
      const date = movie.updatedAt ? new Date(movie.updatedAt).toISOString() : new Date().toISOString();

      // XML me Link jodo
      xml += `
  <url>
    <loc>https://zackhub.in/movie/${slug}</loc>
    <lastmod>${date}</lastmod>
    <priority>0.80</priority>
  </url>`;
    });

    // XML ka Footer (Khatam)
    xml += `
</urlset>`;

    return {
      statusCode: 200,
      headers,
      body: xml,
    };

  } catch (error) {
    console.error("Sitemap Error:", error);
    return {
      statusCode: 500,
      body: "Error generating sitemap",
    };
  }
};
