const config = require('./config');
const firebase = require('firebase-admin');

class Car {
    constructor() {
        this.laptime = undefined;
        this.guid = undefined;
        this.username = undefined;
        this.validLaps = 0;
        this.invalidLaps = 0;
    }
    invalid() {
        this.invalidLaps++;
    }
    valid() {
        this.validLaps++;
    }
}

class ConnectedCars {
    constructor(max_clients) {
        this.cars = {};
        for (var i = 0; i < max_clients; i++) {
            this.resetCar(i);
        }
    }
    getCar(car_id) {
        return this.cars[car_id.toString()];
    }
    resetCar(car_id) {
        this.cars[car_id.toString()] = new Car();
    }
    setLaptime(car_id, laptime) {
        this.cars[car_id.toString()].laptime = laptime;
    }
    setGuid(car_id, guid) {
        this.cars[car_id.toString()].guid = guid;
    }
    setUsername(car_id, username) {
        this.cars[car_id.toString()].username = username;
    }
}

class DB {
    async init(app, track, car) {
        firebase.initializeApp(Object.assign({ credential: firebase.credential.cert(config.firebaseSecret) }, config.firebase));
        this.db = firebase.database();
        this.track = track;
        this.car = car
        this.trackbest = await this.getTrackBest();
        this.banned = await this.getData('banned') || [];
        this.connected = new ConnectedCars(config.serverConfig.SERVER.MAX_CLIENTS); // order by car id
        console.log('all ok')
        for (var i = 0; i < Object.keys(this.connected).length; i++) {
            app.getCarInfo(i);
        }
    }
    renewUsername(guid, username) {
        const temp = {};
        temp[guid.toString()] = username;
        this.updateData(`username/`, temp);
    }
    async renewLaps(guid, validLaps, invalidLaps) {
        this.updateData(`laps/${guid}/${this.track}`, {
            invalid: await this.getData(`laps/${guid}/${this.track}/invalid`) + invalidLaps,
            valid: await this.getData(`laps/${guid}/${this.track}/valid`) + validLaps
        });
    }
    async getData(route) {
        return new Promise((resolve, reject) => {
            this.db.ref(route).once('value').then(snapshot => resolve(snapshot.val()));
        });
    }
    async getName(guid) {
        return await this.getData(`username/${guid}`)
    }
    async getPersonalBest(guid) {
        return await this.getData(`tracks/${this.track}/${this.car}/personalBest/${guid}`) || 0;
    }
    async getTrackBest() {
        return await this.getData(`tracks/${this.track}/${this.car}/trackBest/`) || { guid: undefined, laptime: 0 };
    }
    async getNextRival(laptime) {
        return new Promise((resolve, reject) => {
            if (laptime === 0) laptime = Number.MAX_SAFE_INTEGER;
            this.db.ref(`tracks/${this.track}/${this.car}/personalBest`).orderByChild('laptime').endAt(laptime).limitToFirst(1).get().then(snapshot => resolve(snapshot.val()));
        });
    }
    async setData(route, data) {
        await this.db.ref(route).set(data);
    }
    async updateData(route, data) {
        await this.db.ref(route).update(data);
    }
    async setPersonalBest(guid, laptime) {
        const temp = {};
        temp[guid.toString()] = laptime;
        await this.updateData(`tracks/${this.track}/${this.car}/personalBest/`, temp);
    }
    setTrackBest(guid, laptime) {
        this.updateData(`tracks/${this.track}/${this.car}/trackBest`, { laptime: laptime, guid: guid });
    }

    // async updateRanking(guid, laptime) {
    //     var ranking = await this.getData(`tracks/${this.track}/ranking/`) || [];
    //     var originalIndex = undefined;
    //     var newIndex = undefined;
    //     for (var i = 0; i < ranking.length; i++) {
    //         if (!newIndex) {
    //             if (i === ranking.length - 1 || laptime < ranking[i + 1].laptime) {
    //                 if (i === 0 || ranking[i].laptime < laptime) {
    //                     newIndex = i;
    //                     if (originalIndex) break;
    //                 }
    //             }
    //         }
    //         if (!originalIndex) {
    //             if (guid == ranking[i].guid) {
    //                 originalIndex = i;
    //                 if (newIndex) break;
    //             }
    //         }
    //     }
    //     if (originalIndex !== undefined)
    //         ranking.splice(originalIndex, 1);
    //     ranking.splice(newIndex, 0, { guid: guid, laptime: laptime });
    //     if (ranking.length > 50) ranking.splice(50, ranking.length - 50);
    //     this.setData(`tracks/${this.track}/ranking`, ranking);
    //     return ranking;
    // }
}

module.exports = DB;