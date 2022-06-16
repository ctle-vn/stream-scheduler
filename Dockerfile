FROM library/postgres
COPY ./database/init.sql /docker-entrypoint-initdb.d/
