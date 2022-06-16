BEGIN;

-- initialise your tables here
-- insert some test data if you like
-- DROP TABLE stream_orders;

CREATE TABLE IF NOT EXISTS stream_orders (
    id serial PRIMARY KEY,
   event_name varchar(100) NOT NULL,
   event_receiver varchar(100) NOT NULL,
   event_sender varchar(100) NOT NULL,
   event_block_number bigint NOT NULL,
   event_flow_rate numeric(30,0) NOT NULL, -- int96
   event_end_time numeric(78,0) NOT NULL, -- uint256
   event_start_time numeric(78,0) NOT NULL, -- uint256
   event_super_token varchar(100),
   event_user_data varchar(100)
);

-- Insert some test data into stream_orders
-- INSERT INTO stream_orders (
--     event_name,
--     event_receiver,
--     event_sender,
--     event_block_number,
--     event_flow_rate,
--     event_end_time,
--     event_start_time
-- ) VALUES (
--     'test',
--     'fake_receiver',
--     'fake_senderroo',
--     0,
--     1000000000000,
--     1656266815,
--     1655267815
-- );

-- INSERT INTO stream_orders (
--     event_name,
--     event_receiver,
--     event_sender,
--     event_block_number,
--     event_flow_rate,
--     event_end_time,
--     event_start_time
-- ) VALUES (
--     'test',
--     'fake_receiver',
--     'fake_senderroo',
--     2,
--     1000000000000,
--     1656276815,
--     1655267815
-- );

-- Query table for the latest block number
-- SELECT event_block_number FROM stream_orders ORDER BY event_block_number DESC LIMIT 1;

COMMIT;