# Stage 1: Build the app
FROM node:18-alpine as build
WORKDIR /react-app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /react-app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

# docker build -t react-app .      
# docker run -p 3000:80 react-app  