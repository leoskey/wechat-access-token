const debug = require('debug')('WechatAccessToken');
const Redis = require('ioredis');
const axios = require('axios');

class WechatAccessTokenError extends Error {
  /**
   * Creates an instance of WechatAccessTokenError.
   * @param {*} message
   * @memberof WechatAccessTokenError
   */
  constructor(message) {
    super(message);
    this.name = 'WechatAccessTokenError';
    this.message = message;
  }
};

class WechatAccessToken {
  /**
   * Creates an instance of WechatAccessToken.
   * @param {*} { appID, appSecret, redis }
   * @memberof WechatAccessToken
   */
  constructor({ appID, appSecret, redis }) {
    this.URL_ACCESS_TOKEN = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appID}&secret=${appSecret}`;
    this.KEY_ACCESS_TOKEN = `wechat_access_token/${appID}`;
    this.KEY_ACCESS_TOKEN_LOCK = `wechat_access_token_lock/${appID}`;
    this.KEY_ACCESS_TOKEN_REDIS_CHANNEL = `new_wechat_access_token_${appID}`;
    this.redisConfig = redis;
    this.redis = new Redis(redis);
  }

  /**
   * get accessToken。
   *
   * @param {*} [name=Date.now()]
   * @returns
   * @memberof WechatAccessToken
   */
  async getAccessToken(name = Date.now()) {
    const redis = this.redis;
    const accessToken = {
      setAsync: async(accessToken, ttl) => {
        return await redis.set(this.KEY_ACCESS_TOKEN, accessToken, 'EX', ttl);
      },
      getAsync: async() => {
        const accessToken = await redis.get(this.KEY_ACCESS_TOKEN);
        if (!accessToken) return null;
        const expiresIn = await redis.ttl(this.KEY_ACCESS_TOKEN);
        return { accessToken, expiresIn };
      },
      setLockAsync: async(ttl) => {
        const result = await redis.setnx(this.KEY_ACCESS_TOKEN_LOCK, true);
        if (result) await redis.expire(this.KEY_ACCESS_TOKEN_LOCK, ttl);
        return result;
      },
      removeLockAsync: async() => {
        return await redis.del(this.KEY_ACCESS_TOKEN_LOCK);
      }
    };

    debug(`[${name}] start`);
    let result = await accessToken.getAsync();

    if (result && result.expiresIn > 300) {
      debug(`[${name}] is exist`);
      return result;
    };

    const promise = new Promise(async(resolve, reject) => {
      const isLock = await accessToken.setLockAsync(5);
      if (isLock) {
        debug(`[${name}] lock`);
        try {
          const { data } = await axios.get(this.URL_ACCESS_TOKEN);
          if (!data.access_token) throw new WechatAccessTokenError(JSON.stringify(data));
          await accessToken.setAsync(data.access_token, data.expires_in);
          const isRemove = await accessToken.removeLockAsync(this.KEY_ACCESS_TOKEN_LOCK);
          debug(`[${name}] unlock`);
          redis.publish(this.KEY_ACCESS_TOKEN_REDIS_CHANNEL, JSON.stringify(data));
          resolve(data);
        } catch (error) {
          reject(error)
        }

      } else {
        if (result && result.expiresIn > 10) return resolve(result);

        const redis2 = new Redis(this.redisConfig);
        redis2.on('message', (channel, message) => { resolve(message); });
        redis2.subscribe(this.KEY_ACCESS_TOKEN_REDIS_CHANNEL);
        debug(`[${name}] subscribe chanel: ${this.KEY_ACCESS_TOKEN_REDIS_CHANNEL}`);
      }

    });

    return promise;

  }

}

module.exports = WechatAccessToken;