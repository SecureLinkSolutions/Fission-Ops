import http from 'http';
import app from './app';
import { initSocket } from './socket';
import { config } from './config';

const server = http.createServer(app);
initSocket(server);
server.listen(config.PORT, () => console.log(`Server listening on :${config.PORT}`));
export { server };
