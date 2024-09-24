const amqp = require('amqplib');

async function sendNotification() {
    const connection = await amqp.connect('amqp://user:password@localhost:5673');
    const channel = await connection.createChannel();
    const queue = 'notification';

    await channel.assertQueue(queue);

    for (let i = 0; i < 100; i++) {
        const message = {
            tenantId: Math.floor(Math.random() * 5) + 1,
            eventId: Math.floor(Math.random() * 10) + 1,
            message: `Notification message ${i + 1}`,
        };

        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
        console.log(`Sent: ${JSON.stringify(message)}`);
    }

    await channel.close();
    await connection.close();
}

sendNotification().catch(console.error);