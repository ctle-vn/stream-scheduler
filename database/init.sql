BEGIN;

-- initialise your tables here
-- insert some test data if you like

CREATE TABLE IF NOT EXISTS stream_orders (
    id serial PRIMARY KEY,
   event_name varchar(100) NOT NULL,
   event_receiver varchar(100) NOT NULL,
   event_sender varchar(100) NOT NULL,
   event_data_hash varchar(100),
   event_block_number varchar(100),
   event_timestamp varchar(100),
   event_super_token varchar(100),
   event_flow_rate varchar(100),
   event_end_time varchar(100),
   event_user_data varchar(100) 
);

-- Insert some test data into stream_orders
INSERT INTO stream_orders (
    event_name,
    event_receiver,
    event_sender
) VALUES (
    'test',
    'fake_receiver',
    'fake_senderroo'
);

COMMIT;