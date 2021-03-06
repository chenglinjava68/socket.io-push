module.exports = (config, stats) => {
    return new XiaomiProvider(config, stats);
};

const logger = require('winston-proxy')('XiaomiProvider');

const util = require('socket.io-push-redis/util');//@tochange
const request = require('request');
const sendOneUrl = "https://api.xmpush.xiaomi.com/v3/message/regid";
const sendAllUrl = "https://api.xmpush.xiaomi.com/v3/message/all";
const timeout = 5000;

class XiaomiProvider {

    constructor(config, stats) {
        this.stats = stats;
        this.headers = {
            'Authorization': 'key=' + config.app_secret
        };
        this.type = "xiaomi";
        this.notify_foreground = config.notify_foreground || 1;
    }

    sendMany(notification, tokenDataList, timeToLive, callback) {
        if (notification.android.title) {
            this.stats.addPushTotal(1, this.type);
            request.post({
                url: sendOneUrl,
                form: this.getPostData(notification, tokenDataList, timeToLive),
                headers: this.headers,
                timeout: timeout
            }, (error, response, body) => {
                logger.debug("sendOne result", error, response && response.statusCode, body);
                if (this.success(error, response, body, callback)) {
                    this.stats.addPushSuccess(1, this.type);
                    return;
                }
                logger.error("sendOne error", error, response && response.statusCode, body);
            })
        }
    }

    getPostData(notification, tokenDataList, timeToLive) {
        logger.debug("getPostData notification ", notification, ": tokenlist: ", tokenDataList);
        const postData = {
            title: notification.android.title,
            description: notification.android.message,
            notify_id: util.hash(notification.id),
            "extra.notify_foreground": this.notify_foreground,
            payload: JSON.stringify({android: notification.android, id: notification.id})
        };
        if (tokenDataList) {
            postData.registration_id = tokenDataList.map((tokenData) => {
                return tokenData.token;
            }).join();
        }
        if (timeToLive > 0) {
            postData.time_to_live = timeToLive;
        } else {
            postData.time_to_live = 0;
        }
        return postData;
    }

    sendAll(notification, timeToLive, callback) {
        if (notification.android.title) {
            this.stats.addPushTotal(1, this.type + "All");
            logger.debug("addPushTotal");
            request.post({
                url: sendAllUrl,
                form: this.getPostData(notification, 0, timeToLive),
                headers: this.headers,
                timeout: timeout
            }, (error, response, body) => {
                logger.info("sendAll result", error, response && response.statusCode, body);
                if (this.success(error, response, body, callback)) {
                    this.stats.addPushSuccess(1, this.type + "All");
                    return;
                }
                logger.error("sendAll error", error, response && response.statusCode, body);
            });
        }
    }

    success(error, response, body, callback) {
        if (callback) {
            callback(error);
        }
        if (!error && response && response.statusCode == 200) {
            const result = JSON.parse(body);
            if (result.code == 0 || result.code == 20301) {
                return true;
            }
        }
        return false;
    }

}