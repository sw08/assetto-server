const server = require('acserver-plugin');
const app = new server.PluginApp();
const db = new (require('./db'))();
const tools = require('./tools');
const config = require('./config');

db.init(app, config.serverConfig.SERVER.TRACK, config.entryList.CAR_0.MODEL);

app.on(server.PROTOCOLS.NEW_CONNECTION, async (data) => {
    if (db.banned.includes(data.guid)) {
        app.kick(data.car_id);
        return;
    }
    db.connected.setLaptime(data.car_id, await db.getPersonalBest(data.guid));
    db.connected.setGuid(data.car_id, data.guid);
    db.connected.setUsername(data.car_id, data.name);
    db.renewUsername(data.guid, data.name);
});

app.on(server.PROTOCOLS.CAR_INFO, async (data) => {
    if (data.connected) app.listeners[server.PROTOCOLS.NEW_CONNECTION.toString()](data);
});

app.on(server.PROTOCOLS.CLIENT_LOADED, (data) => {
    app.sendChat(data.car_id, '환영합니다!');
    app.sendChat(data.car_id,
        `개인 베스트 랩타임: ${tools.formatTime(db.connected.getCar(data.car_id).laptime)} \
        트랙 베스트 랩타임: ${tools.formatTime(db.trackbest.laptime)}`
    );
    app.sendChat(data.car_id, '!도움을 입력해보세요');
});

app.on(server.PROTOCOLS.CHAT, async (data) => {
    const msg = data.message.trim();
    if (!msg.startsWith('!')) return;
    if (msg === '!라이벌') {
        const laptime = db.connected.getCar(data.car_id).laptime || 0;
        const rival = await db.getNextRival(laptime);
        if (Object.keys(rival).length === 0) {
            app.sendChat(data.car_id, '다음 라이벌이 없습니다.');
        } else {
            const rivallaptime = Object.values(rival)[0];
            app.sendChat(data.car_id, `다음 라이벌: ${await db.getName(Object.keys(rival)[0])} / ${tools.formatTime(rivallaptime)}(-${tools.formatTime(laptime - rivallaptime)})`);
        }
    } else if (msg === '!랩타임') {
        const laptime = db.connected.getCar(data.car_id).laptime;
        if (laptime === undefined) {
            app.sendChat(data.car_id, '기록된 랩타임이 없습니다.');
        } else {
            app.sendChat(data.car_id, `개인 베스트 랩타임: ${tools.formatTime(laptime)}`);
        }
    } else if (msg === '!트랙레코드') {
        const laptime = db.trackbest.laptime;
        if (laptime === 0) {
            app.sendChat(data.car_id, '기록된 랩타임이 없습니다.');
        } else {
            app.sendChat(data.car_id, `트랙 베스트 랩타임: ${await db.getName(db.trackbest.guid)} / ${tools.formatTime(db.trackbest.laptime)}`);
        }
    } else if (msg === '!도움') {
        app.sendChat(data.car_id, "!라이벌: 본인의 바로 윗순위의 기록을 볼 수 있습니다.\n!랩타임: 본인의 최고 기록을 볼 수 있습니다.\n!트랙레코드: 제일 빠른 사람의 기록을 볼 수 있습니다.")
    }
});

app.on(server.PROTOCOLS.LAP_COMPLETED, async (data) => {
    const car = db.connected.getCar(data.car_id);
    if (data.cuts !== 0) {
        car.invalid();
        return;
    }
    car.valid();
    if (car.laptime === 0 || data.laptime < car.laptime) {
        db.connected.setLaptime(data.car_id, data.laptime);
        app.sendChat(data.car_id, `개인 베스트 랩타임 갱신: ${tools.formatTime(data.laptime)}`);
        await db.setPersonalBest(car.guid, data.laptime);
        const next = await db.getNextRival(data.laptime);
        const nextguid = Object.keys(next)[0];
        if (next) {
            app.sendChat(
                data.car_id,
                `다음 라이벌: ${await db.getName(nextguid)}(${index - 1}위) / ${tools.formatTime(next[nextguid])}(-${tools.formatTime(data.laptime - next[nextguid])})`
            );
        }
        if (db.trackbest.laptime === 0 || db.trackbest.laptime > data.laptime) {
            db.setTrackBest(car.guid, data.laptime);
            app.broadcastChat(`트랙 베스트 랩타임 갱신: ${car.username} / ${tools.formatTime(data.laptime)}`);
        }
    }
});

app.on(server.PROTOCOLS.CONNECTION_CLOSED, async (data) => {
    const car = db.connected.getCar(data.car_id);
    await db.renewLaps(car.guid, car.validLaps, car.invalidLaps);
})

app.run(12001);
