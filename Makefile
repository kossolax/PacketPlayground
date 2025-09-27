SERVER ?= ovh.zaretti.be
USER ?= kossolax
NODE_VERSION := --lts

.PHONY: build deploy run install lint clean nvm docker-dist

build: lint
	make nvm CMD="npm run build"

deploy: build
	ssh $(USER)@$(SERVER) 'mkdir -p /var/www/playground.zaretti.be'
	scp -r dist/* $(USER)@$(SERVER):/var/www/playground.zaretti.be

run:
	make nvm CMD="npm run dev"

install:
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
	bash -c 'source ~/.nvm/nvm.sh ; nvm install --lts'
	make nvm CMD="npm install"

lint:
	make nvm CMD="npm run lint:fix"

test:
	make nvm CMD="npm run test"

coverage:
	make nvm CMD="npm run coverage"

clean:
	rm -rf node_modules/ dist/ package-lock.json

nvm:
	bash -c 'source ~/.nvm/nvm.sh ; nvm exec $(NODE_VERSION) $(CMD)'
