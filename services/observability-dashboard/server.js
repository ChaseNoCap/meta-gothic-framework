import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.OBSERVABILITY_PORT || 3005;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
    try {
        // Default to index.html
        let filePath = req.url === '/' ? '/index.html' : req.url;
        
        // Security: prevent directory traversal
        if (filePath.includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Construct full path
        const fullPath = join(__dirname, filePath);
        
        // Read file
        const content = await readFile(fullPath);
        
        // Determine content type
        const ext = extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        // Send response
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            console.error('Server error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

server.listen(PORT, () => {
    console.log(`
🔍 Meta-GOTHIC Observability Platform
📊 Dashboard: http://localhost:${PORT}
🔌 WebSocket: ws://localhost:3000/ws/events

Make sure the gateway is running at port 3000 for real-time events.
    `);
});