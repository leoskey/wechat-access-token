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
  constructor({ redis }) {
    this.redisConfig = redis;
    this.redis = new Redis(redis);
    this.redisOfSubscribe = new Redis(redis);

    this.accessTokenStore = {
      setAsync: async(accessToken, ttl) => {
        return await this.redis.set(this.KEY_ACCESS_TOKEN, accessToken, 'EX', ttl);
      },
      getAsync: async() => {
        const accessToken = await this.redis.get(this.KEY_ACCESS_TOKEN);
        if (!accessToken) return null;
        const expiresIn = await this.redis.ttl(this.KEY_ACCESS_TOKEN);
        return { accessToken, expiresIn };
      },
      setLockAsync: async(ttl) => {
        const result = await this.redis.setnx(this.KEY_ACCESS_TOKEN_LOCK, true);
        if (result) await this.redis.expire(this.KEY_ACCESS_TOKEN_LOCK, ttl);
        return result;
      },
      removeLockAsync: async() => {
        return await this.redis.del(this.KEY_ACCESS_TOKEN_LOCK);
      }
    };

  }

  /**
   * get accessToken。
   *
   * @param {*} [name=Date.now()]
   * @returns
   * @memberof WechatAccessToken
   */
  async getAccessToken({ appID, appSecret }) {
    if (!appID || !appSecret) throw new WechatAccessTokenError('check wechat config');
    this.URL_ACCESS_TOKEN = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appID}&secret=${appSecret}`;
    this.KEY_ACCESS_TOKEN = `wechat_access_token/${appID}`;
    this.KEY_ACCESS_TOKEN_LOCK = `wechat_access_token_lock/${appID}`;
    this.KEY_ACCESS_TOKEN_REDIS_CHANNEL = `new_wechat_access_token_${appID}`;

    const name = Date.now();
    const accessTokenStore = this.accessTokenStore;

    debug(`[${name}] start`);
    let accessTokenResult = await accessTokenStore.getAsync();

    if (accessTokenResult && accessTokenResult.expiresIn > 300) {
      debug(`[${name}] is exist`);
      return accessTokenResult;
    };

    const promise = new Promise(async(resolve, reject) => {
      const isLock = await accessTokenStore.setLockAsync(5);
      if (isLock) {
        try {
          debug(`[${name}] lock`);
          let { data } = await axios.get(this.URL_ACCESS_TOKEN);
          if (!data.access_token) throw new WechatAccessTokenError(JSON.stringify(data));

          data = { accessToken: data.access_token, expiresIn: data.expires_in }
          await accessTokenStore.setAsync(data.accessToken, data.expiresIn);
          await accessTokenStore.removeLockAsync(this.KEY_ACCESS_TOKEN_LOCK);
          debug(`[${name}] unlock`);
          this.redis.publish(this.KEY_ACCESS_TOKEN_REDIS_CHANNEL, JSON.stringify(data));
          resolve(data);

        } catch (error) {
          reject(error);
        }

      } else {
        if (accessTokenResult && accessTokenResult.expiresIn > 10) return resolve(accessTokenResult);

        this.redisOfSubscribe.on('message', (channel, message) => { resolve(JSON.parse(message)); });
        this.redisOfSubscribe.subscribe(this.KEY_ACCESS_TOKEN_REDIS_CHANNEL);
        debug(`[${name}] subscribe chanel: ${this.KEY_ACCESS_TOKEN_REDIS_CHANNEL}`);

      }

    });
    return promise;

  }

}

module.exports = {
  WechatAccessToken,
  WechatAccessTokenError
};