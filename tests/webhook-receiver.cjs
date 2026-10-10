const http = require('node:http');
let count = 0;
http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.url === '/count') { res.end(String(count)); return; }
  count++;
  res.statusCode = req.url === '/fail' ? 503 : 200;
  res.end(req.url === '/fail' ? 'Receiver unavailable' : 'Webhook accepted');
}).listen(3199, '127.0.0.1');
