import { config } from '@/config';
import ConfigNotFoundError from '@/errors/types/config-not-found';

import login from './login';

let tokenIndex = 0;

async function getToken() {
    let token;
    if (config.twitter.username && config.twitter.password) {
        const index = tokenIndex++ % config.twitter.username.length;
        const username = config.twitter.username[index];
        const password = config.twitter.password[index];
        const authenticationSecret = config.twitter.authenticationSecret?.[index];
        const phoneOrEmail = config.twitter.phoneOrEmail?.[index];
        if (username && password) {
            const authentication = await login({
                username,
                password,
                authenticationSecret,
                phoneOrEmail,
            });
            if (!authentication) {
                throw new ConfigNotFoundError(`Invalid twitter configs: ${username}`);
            }
            token = {
                key: authentication.oauth_token,
                secret: authentication.oauth_token_secret,
                cacheKey: `twitter:authentication:${username}`,
            };
        }
    } else if (config.twitter.oauthTokens?.length && config.twitter.oauthTokenSecrets?.length && config.twitter.oauthTokens?.length === config.twitter.oauthTokenSecrets?.length) {
        token = {
            key: config.twitter.oauthTokens[tokenIndex],
            secret: config.twitter.oauthTokenSecrets[tokenIndex],
        };

        tokenIndex++;
        if (tokenIndex >= config.twitter.oauthTokens.length) {
            tokenIndex = 0;
        }
    } else {
        throw new ConfigNotFoundError('Invalid twitter configs');
    }

    return token;
}

export { getToken };
