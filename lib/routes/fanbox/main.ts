import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { isValidHost } from '@/utils/valid-host';
import { convArticle, headers } from './utils';

export const route: Route = {
    path: '/:user?',
    categories: ['social-media'],
    example: '/fanbox/otomeoto',
    parameters: { user: 'optional - User name. Can be found in URL. Default is official news' },
    radar: [
        {
            source: ['fanbox.cc/@:user'],
        },
    ],
    name: 'User',
    maintainers: ['sgqy', 'zipated'],
    handler,
};

async function handler(ctx) {
    const user = ctx.req.param('user') || 'official'; // if no user specified, just go to official page
    if (!isValidHost(user)) {
        throw new Error('Invalid user');
    }
    const boxUrl = `https://${user}.fanbox.cc`;

    // Get user info
    let title = `${user}'s fanbox`;
    let descr = title;

    try {
        const userApi = `https://api.fanbox.cc/creator.get?creatorId=${user}`;
        const respU = await ofetch(userApi, { headers });
        title = `${respU.body.user.name}'s fanbox`;
        descr = respU.body.description;
    } catch (error) {
        error;
    }

    // Get user posts
    const postsApi = `https://api.fanbox.cc/post.listCreator?creatorId=${user}&limit=20`;
    const response = await ofetch(postsApi, { headers });

    // Render posts
    const items = await Promise.all(response.body.items.map((i) => convArticle(i)));

    // Return RSS feed
    return {
        title,
        link: boxUrl,
        description: descr,
        item: items,
    };
}
