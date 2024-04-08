import { Route } from '@/types';
import got from '@/utils/got';
import { isValidHost } from '@/utils/valid-host';
import { conv_article, get_header } from './utils';


export const route: Route = {
    path: '/:user',
    categories: ['social-media'],
    example: '/fanbox/otomeoto',
    parameters: { user: 'User name. Can be found in URL.' },
    radar: [
        {
            source: ['fanbox.cc/@:user'],
        },
    ],
    name: 'User Posts',
    maintainers: ['sgqy'],
    handler,
};

async function handler(ctx) {
    const user = ctx.req.param('user')
    if (!isValidHost(user)) {
        throw new Error('Invalid user');
    }
    const boxUrl = `https://${user}.fanbox.cc`;

    // Get user info
    let title = `${user}'s fanbox`;
    let descr = title;

    try {
        const userApi = `https://api.fanbox.cc/creator.get?creatorId=${user}`;
        const respU = await got(userApi, { headers: get_header() });
        title = `${respU.data.body.user.name}'s fanbox`;
        descr = respU.data.description;
    } catch (error) {
        error;
    }

    // Get user posts
    const postsApi = `https://api.fanbox.cc/post.listCreator?creatorId=${user}&limit=20`;
    const response = await got(postsApi, { headers: get_header() });

    // Render posts
    const items = await Promise.all(response.data.body.items.map((i) => conv_article(i)));

    // Return RSS feed
    return {
        title,
        link: boxUrl,
        description: descr,
        item: items,
    };
};
