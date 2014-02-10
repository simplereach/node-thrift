
var assert = require('assert');
var domain = require('domain');

var TFramedTransport = new require('../lib/thrift/transport').TFramedTransport;

describe('TFramedTransport', function() {

    describe('receiver', function() {

        /**
         * Ensure that if the consumer callback throws an error, the internal state of the
         * receiver does not become invalid.
         */
        it('does not break state from consumer callback exception', function(callback) {
            // Hold the test in a domain so we can intercept exceptions, and stop the test from failing
            // as a result.
            var d = domain.create();

            var receiverExceptionCount = 0;
            var framesReceived = 0;

            /*!
             * Exit the test when all expected errors have been raised and all expected
             * frames have been received.
             */
            var _exit = function() {
                if (receiverExceptionCount === 1 && framesReceived === 2) {
                    d.exit();
                    return callback();
                }
            };

            // Keep track of receiver exceptions handled
            d.on('error', function(err) {
                // The only error we expect is the "Receiver Exception" error
                assert.equal(err.message, 'Receiver Exception');
                receiverExceptionCount++;
                _exit();
            });

            d.enter();

            // Force a next tick to stop mocha from catch the exception and declaring the test a failure
            process.nextTick(function() {

                var receiver = TFramedTransport.receiver(function(tframe) {
                    framesReceived++;
                    if (framesReceived === 1) {
                        // First frame should be "This is great!"
                        assert.equal(tframe.readAll().toString('utf8'), 'This is great!');

                        // Throw an exception to try and mess up the state of the receiver
                        throw new Error('Receiver Exception');
                    } else if (framesReceived === 2) {
                        assert.equal(tframe.readAll().toString('utf8'), 'I am having fun!');

                        // It did not damage the second frame, test passes
                        _exit();
                    } else {
                        assert.fail();
                    }
                });

                // Our first frame will be a 14-byte frame split into 2 blobs of data
                process.nextTick(function() {
                    receiver(Buffer.concat([
                        new Buffer([0, 0, 0, 14]),
                        new Buffer('This is', 'utf8')
                    ]));
                });

                // Transfer the rest of the first frame, plus the start of a new frame. This gives the consumer callback
                // an opportunity to try and throw an exception that renders the receiver in an invalid state
                process.nextTick(function() {
                    receiver(Buffer.concat([

                        // After this " great!" string is transfered, the receiver will be invoked and it will throw an
                        // exception. We want to very that the exception did not stop us from being able to transfer the
                        // remaining data of the test
                        new Buffer(' great!', 'utf8'),

                        // Start the second frame, which will be 16 bytes
                        new Buffer([0, 0, 0, 16]),
                        new Buffer('I am ha', 'utf-8')
                    ]));
                });

                // Finish off the last frame
                process.nextTick(function() {

                    /*!
                     * If this test fails, the receipt of this blob of data will result in an error:
                     *
                     *  RangeError: length > kMaxLength
                     *
                     * Because the receiver has reached an invalid state, and the "ving" (first 4 bytes)
                     * of this data will be read as the size of the next frame, which is 1735289206 bytes
                     * and way too big to allocate into a buffer.
                     *
                     * In worst case scenario, the receiver will slice an incorrect range out of the buffer
                     * and result in simply assembling invalid frame of data!
                     */
                    receiver(new Buffer('ving fun!', 'utf8'));
                });
            });
        });
    });
});
