## Development Server Lifecycle

When testing the API or frontend:

- Never leave development servers running after the task is complete.
- Before starting a development server, check whether the required port is already occupied.
- If a server is needed only for testing, start it in a way that allows it to be cleanly terminated.
- After testing is complete, ALWAYS stop the server and all of its child processes.
- Do not leave `npm run dev`, `ts-node-dev`, `nodemon`, Vite, or other watch-mode processes running in the background.
- Do not kill only the child `node` process when using `ts-node-dev --respawn`; terminate the parent `ts-node-dev`/npm process as well.
- Before finishing a task, verify that temporary development processes started by the agent have been terminated.
- Port 4000 must be free when the agent finishes unless the user explicitly requested that the API remain running.

### API testing

The API development command is:

    npm run dev:api

If the API must be started for testing, record its PID/process group and cleanly terminate the entire process tree when testing is finished.

Prefer running temporary API tests using a non-watch-mode process when possible rather than leaving `ts-node-dev --respawn` running.