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

-- Insert expired stream_order
-- INSERT INTO stream_orders (
--     event_name,
--     event_receiver,
--     event_sender,
--     event_block_number,
--     event_flow_rate,
--     event_end_time,
--     event_start_time,
--     event_super_token,
--     event_user_data
-- ) VALUES (
--     'test',
--     '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
--     '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
--     0,
--     1000000000000,
--     1653421260,
--     1652267815,
--     '0x1f65B7b9b3ADB4354fF76fD0582bB6b0d046a41c',
--     '0x00'
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