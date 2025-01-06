const { Client } = require('@notionhq/client');

async function fetchAllTradeEntries(notion, databaseId) {
    let allEntries = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
        const response = await notion.databases.query({
            database_id: databaseId,
            start_cursor: startCursor,
            filter: {
                property: 'Status',
                select: {
                    equals: 'Closed'
                }
            }
        });

        allEntries = [...allEntries, ...response.results];
        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    return allEntries;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        const notion = new Client({ auth: process.env.NOTION_TOKEN });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Fetch all closed trades
        const entries = await fetchAllTradeEntries(notion, process.env.NOTION_DATABASE_ID);
        
        const pnlData = {
            today: 0,
            week: 0,
            month: 0,
            total: 0
        };

        // Process each trade
        entries.forEach(entry => {
            try {
                // Check if trade has necessary properties
                if (!entry.properties["Exit Date"]?.date || !entry.properties["P&L"]?.formula) {
                    return;
                }
                
                const exitDate = new Date(entry.properties["Exit Date"].date.start);
                exitDate.setHours(0, 0, 0, 0); // Normalize to start of day
                const pnl = entry.properties["P&L"].formula.number;
                const daysDiff = Math.floor((today - exitDate) / (1000 * 60 * 60 * 24));

                // Add to total
                pnlData.total += pnl;

                // Add to respective time periods based on exit date
                if (daysDiff === 0) {
                    pnlData.today += pnl;
                }
                if (daysDiff < 7) {
                    pnlData.week += pnl;
                }
                if (daysDiff < 30) {
                    pnlData.month += pnl;
                }
            } catch (entryError) {
                console.error('Error processing entry:', entryError);
            }
        });

        // Round all values to 2 decimal places
        Object.keys(pnlData).forEach(key => {
            pnlData[key] = Math.round(pnlData[key] * 100) / 100;
        });

        const firstTrade = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
            sorts: [
                {
                    property: 'Entry Date',
                    direction: 'ascending'
                }
            ],
            page_size: 1
        });

        pnlData["firstTradeDate"] = firstTrade.results[0]?.properties['Entry Date']?.date?.start

        res.status(200).json(pnlData);
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch P&L data',
            message: error.message,
            code: error.code
        });
    }
};