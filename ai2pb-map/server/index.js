import { createServer } from "./app.js";

const PORT = process.env.PORT || 5174;
const app = createServer();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
