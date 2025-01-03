const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Fetch all entries
        const response = await notion.databases.query({
            database_id: DATABASE_ID
        });

        const entries = response.results;
        
        const pnlData = {
            today: 0,
            week: 0,
            month: 0,
            total: 0
        };

        entries.forEach(entry => {
            if (!entry.properties.Date.date || !entry.properties.P&L.number) return;
            
            const entryDate = new Date(entry.properties.Date.date.start);
            const pnl = entry.properties.P&L.number;
            const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

            // Add to total
            pnlData.total += pnl;

            // Check timeframes
            if (daysDiff === 0) pnlData.today += pnl;
            if (daysDiff <= 7) pnlData.week += pnl;
            if (daysDiff <= 30) pnlData.month += pnl;
        });

        res.status(200).json(pnlData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch P&L data' });
    }
};
