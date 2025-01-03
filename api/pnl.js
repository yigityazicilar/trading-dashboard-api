const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        // Log environment variables (excluding sensitive parts)
        console.log('Database ID exists:', !!process.env.NOTION_DATABASE_ID);
        console.log('Token exists:', !!process.env.NOTION_TOKEN);

        if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
            throw new Error('Missing environment variables');
        }

        const notion = new Client({ auth: process.env.NOTION_TOKEN });
        
        // Try to query the database
        try {
            const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID
            });

            // Log the response structure (without sensitive data)
            console.log('Data received:', {
                resultCount: response.results.length,
                hasMore: response.has_more
            });

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const pnlData = {
                today: 0,
                week: 0,
                month: 0,
                total: 0
            };

            // Process entries
            response.results.forEach(entry => {
                try {
                    if (!entry.properties.Date?.date || !entry.properties['P&L']?.number) {
                        console.log('Skipping entry due to missing data');
                        return;
                    }
                    
                    const entryDate = new Date(entry.properties.Date.date.start);
                    const pnl = entry.properties['P&L'].number;
                    const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

                    pnlData.total += pnl;
                    if (daysDiff === 0) pnlData.today += pnl;
                    if (daysDiff <= 7) pnlData.week += pnl;
                    if (daysDiff <= 30) pnlData.month += pnl;
                } catch (entryError) {
                    console.error('Error processing entry:', entryError);
                }
            });

            res.status(200).json(pnlData);
        } catch (notionError) {
            console.error('Notion API error:', notionError);
            throw notionError;
        }
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch P&L data',
            message: error.message,
            code: error.code
        });
    }
};