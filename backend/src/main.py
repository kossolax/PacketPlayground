from api import FastAPIServer

if __name__ == "__main__":
    server = FastAPIServer()
    server.start(port=5020)
    # wait for the server to stop