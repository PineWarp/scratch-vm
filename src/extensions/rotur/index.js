/* eslint-disable max-len */
const formatMessage = require('format-message');
const {defineExtension, BlockType, ArgumentType} = require('./core');

const R = BlockType.REPORTER;
const C = BlockType.COMMAND;
const B = BlockType.BOOLEAN;

const num = defaultValue => ({type: ArgumentType.NUMBER, defaultValue});
const menu = (name, defaultValue) => ({type: ArgumentType.STRING, menu: name, defaultValue});

const COLORS = {
    color1: '#75C1C4',
    color2: '#5da8cc',
    color3: '#3C7699'
};

const ext = (id, name, specs, menus) => defineExtension(id, {name, ...COLORS, menus: menus || {}}, specs);

const account = ext('bilupAccounts', formatMessage({id: 'rotur.bilupAccounts.name', default: 'Bilup Accounts', description: 'Extension name for the Bilup Accounts extension'}), [
    {opcode: 'loggedIn', blockType: B, text: formatMessage({id: 'rotur.bilupAccounts.loggedIn', default: 'am I logged in?', description: 'Whether the user is currently logged in'}), local: 'loggedIn'},
    {opcode: 'myUsername', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.myUsername', default: 'my username', description: 'The username of the logged in user'}), local: 'username'},
    {opcode: 'myId', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.myId', default: 'my user id', description: 'The user id of the logged in user'}), local: 'id'},
    {label: formatMessage({id: 'rotur.bilupAccounts.label.permissions', default: 'Permissions', description: 'Section label for permission blocks'})},
    {opcode: 'myPermissions', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.myPermissions', default: 'permissions I have', description: 'Permissions granted to the current login'}), local: 'permissions'},
    {opcode: 'allows', blockType: B, text: formatMessage({id: 'rotur.bilupAccounts.allows', default: 'does my login allow [SCOPE]?', description: 'Whether the current login allows the given scope'}), args: {SCOPE: 'credits:transfer'}, local: 'allows'},
    {opcode: 'request', blockType: C, text: formatMessage({id: 'rotur.bilupAccounts.request', default: 'ask to allow [SCOPES]', description: 'Ask the user to grant the given scopes'}), args: {SCOPES: 'credits:transfer, posts:create'}, local: 'request'},
    {label: formatMessage({id: 'rotur.bilupAccounts.label.account', default: 'Account', description: 'Section label for account blocks'})},
    {opcode: 'accountInfo', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.accountInfo', default: 'my account info', description: 'Information about the current account'}), method: 'me.get', scope: 'account:view', map: () => [], result: r => r},
    {opcode: 'accountField', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.accountField', default: 'my account [FIELD]', description: 'A single field from the current account'}), args: {FIELD: 'sys.currency'}, method: 'me.get', scope: 'account:view', map: () => [], result: (r, a) => (r && typeof r === 'object' ? r[a.FIELD] : '')},
    {opcode: 'checkAuth', blockType: B, text: formatMessage({id: 'rotur.bilupAccounts.checkAuth', default: 'is my login valid?', description: 'Whether the current login is still valid'}), method: 'me.checkAuth', map: () => [], result: r => Boolean(r && r.username)},
    {opcode: 'myBadges', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.myBadges', default: 'my badges', description: 'Badges earned by the current user'}), method: 'me.badges', scope: 'account:view', map: () => [], result: r => JSON.stringify((r && r.badge_names) || [])},
    {opcode: 'mySubscription', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.mySubscription', default: 'my subscription', description: 'The subscription of the current user'}), method: 'me.subscription', scope: 'account:view', map: () => []},
    {opcode: 'blockedUsers', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.blockedUsers', default: 'users I have blocked', description: 'Users blocked by the current user'}), method: 'me.blocked', scope: 'blocked:view', map: () => [], result: r => JSON.stringify((r && r.blocked) || [])},
    {opcode: 'block', blockType: C, text: formatMessage({id: 'rotur.bilupAccounts.block', default: 'block [USER]', description: 'Block the given user'}), args: {USER: 'username'}, method: 'me.block', scope: 'blocked:manage', map: a => [a.USER]},
    {opcode: 'unblock', blockType: C, text: formatMessage({id: 'rotur.bilupAccounts.unblock', default: 'unblock [USER]', description: 'Unblock the given user'}), args: {USER: 'username'}, method: 'me.unblock', scope: 'blocked:manage', map: a => [a.USER]},
    {label: formatMessage({id: 'rotur.bilupAccounts.label.people', default: 'People', description: 'Section label for people related blocks'})},
    {opcode: 'profileOf', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.profileOf', default: 'profile of [USER]', description: 'The profile of the given user'}), args: {USER: 'username'}, method: 'profiles.get', map: a => [a.USER]},
    {opcode: 'userExists', blockType: B, text: formatMessage({id: 'rotur.bilupAccounts.userExists', default: 'does user [USER] exist?', description: 'Whether the given user exists'}), args: {USER: 'username'}, method: 'profiles.exists', map: a => [a.USER], result: r => Boolean(r && r.exists)},
    {opcode: 'avatarOf', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.avatarOf', default: 'avatar url of [USER]', description: 'The avatar url of the given user'}), args: {USER: 'username'}, method: 'profiles.getAvatarUrl', map: a => [a.USER]},
    {opcode: 'standingOf', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.standingOf', default: 'moderation standing of [USER]', description: 'The moderation standing of the given user'}), args: {USER: 'username'}, method: 'standing.get', map: a => [a.USER]},
    {opcode: 'isBanned', blockType: B, text: formatMessage({id: 'rotur.bilupAccounts.isBanned', default: 'is [USER] banned?', description: 'Whether the given user is banned'}), args: {USER: 'username'}, method: 'check.banned', map: a => [[a.USER]], result: (r, a) => Boolean(r && r[a.USER])},
    {label: formatMessage({id: 'rotur.bilupAccounts.label.notifications', default: 'Notifications', description: 'Section label for notification blocks'})},
    {opcode: 'notifications', blockType: R, text: formatMessage({id: 'rotur.bilupAccounts.notifications', default: 'my notifications', description: 'Notifications of the current user'}), method: 'notifications.list', scope: 'notifications:view', map: () => []}
]);

const economy = ext('bilupEconomy', formatMessage({id: 'rotur.bilupEconomy.name', default: 'Bilup Accounts Economy', description: 'Extension name for the Bilup Accounts Economy extension'}), [
    {opcode: 'balance', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.balance', default: 'my credits', description: 'The credit balance of the current user'}), method: 'me.get', scope: 'credits:view', map: () => [], result: r => (r && typeof r['sys.currency'] === 'number' ? r['sys.currency'] : 0)},
    {opcode: 'pay', blockType: C, text: formatMessage({id: 'rotur.bilupEconomy.pay', default: 'send [AMOUNT] credits to [USER] with message [NOTE]', description: 'Send credits to another user with an optional message'}), args: {AMOUNT: num(1), USER: 'username', NOTE: ''}, method: 'me.transfer', scope: 'credits:transfer', sensitive: true, confirm: a => ({type: 'payment', amount: Number(a.AMOUNT) || 0, recipient: String(a.USER || '')}), map: a => [a.USER, Number(a.AMOUNT) || 0, a.NOTE]},
    {opcode: 'dailyWait', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.dailyWait', default: 'seconds until daily claim', description: 'Seconds remaining until the daily credit claim is available'}), method: 'me.claimTime', scope: 'credits:view', map: () => [], result: r => (r && typeof r.wait_time === 'number' ? r.wait_time : 0)},
    {opcode: 'transactions', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.transactions', default: 'my transaction history', description: 'The transaction history of the current user'}), method: 'me.transactions', scope: 'credits:view', map: () => []},
    {label: formatMessage({id: 'rotur.bilupEconomy.label.gifts', default: 'Gifts', description: 'Section label for gift blocks'})},
    {opcode: 'createGift', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.createGift', default: 'create a gift of [AMOUNT] credits', description: 'Create a gift code worth the given amount of credits'}), args: {AMOUNT: num(10)}, method: 'gifts.create', scope: 'gifts:create', sensitive: true, confirm: formatMessage({id: 'rotur.bilupEconomy.confirm.createGift', default: 'create a credit gift', description: 'Confirmation text when creating a credit gift'}), map: a => [Number(a.AMOUNT) || 0]},
    {opcode: 'giftInfo', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.giftInfo', default: 'gift info for code [CODE]', description: 'Information about the gift code'}), args: {CODE: 'code'}, method: 'gifts.get', map: a => [a.CODE]},
    {opcode: 'claimGift', blockType: C, text: formatMessage({id: 'rotur.bilupEconomy.claimGift', default: 'claim gift code [CODE]', description: 'Claim the credits from a gift code'}), args: {CODE: 'code'}, method: 'gifts.claim', scope: 'gifts:claim', sensitive: true, confirm: formatMessage({id: 'rotur.bilupEconomy.confirm.claimGift', default: 'claim this gift', description: 'Confirmation text when claiming a gift'}), map: a => [a.CODE]},
    {opcode: 'cancelGift', blockType: C, text: formatMessage({id: 'rotur.bilupEconomy.cancelGift', default: 'cancel gift [ID]', description: 'Cancel a gift by its id'}), args: {ID: 'id'}, method: 'gifts.cancel', scope: 'gifts:cancel', map: a => [a.ID]},
    {opcode: 'myGifts', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.myGifts', default: 'gifts I created', description: 'Gifts created by the current user'}), method: 'gifts.mine', scope: 'gifts:view', map: () => []},
    {label: formatMessage({id: 'rotur.bilupEconomy.label.stats', default: 'Stats', description: 'Section label for economy statistics blocks'})},
    {opcode: 'economyStats', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.economyStats', default: 'network economy stats', description: 'Economy statistics for the whole network'}), method: 'stats.economy', map: () => []},
    {opcode: 'mostGained', blockType: R, text: formatMessage({id: 'rotur.bilupEconomy.mostGained', default: 'top credit earners', description: 'The users who have gained the most credits'}), method: 'stats.mostGained', map: () => []}
]);

const keys = ext('bilupKeys', formatMessage({id: 'rotur.bilupKeys.name', default: 'Bilup Accounts Keys', description: 'Extension name for the Bilup Accounts Keys extension'}), [
    {opcode: 'myKeys', blockType: R, text: formatMessage({id: 'rotur.bilupKeys.myKeys', default: 'my keys', description: 'Keys owned by the current user'}), method: 'keys.mine', scope: 'keys:view', map: () => []},
    {opcode: 'keyInfo', blockType: R, text: formatMessage({id: 'rotur.bilupKeys.keyInfo', default: 'details of key [ID]', description: 'Details of the key with the given id'}), args: {ID: 'id'}, method: 'keys.get', map: a => [a.ID]},
    {opcode: 'userHasKey', blockType: B, text: formatMessage({id: 'rotur.bilupKeys.userHasKey', default: 'does [USER] own key [KEY]?', description: 'Whether the given user owns the given key'}), args: {USER: 'username', KEY: 'key'}, method: 'keys.check', map: a => [a.USER, a.KEY], result: r => Boolean(r && (r.owns || r.owned || r.has))},
    {opcode: 'buyKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.buyKey', default: 'buy key [ID]', description: 'Buy the key with the given id'}), args: {ID: 'id'}, method: 'keys.buy', sensitive: true, confirm: formatMessage({id: 'rotur.bilupKeys.confirm.buyKey', default: 'buy this key', description: 'Confirmation text when buying a key'}), map: a => [a.ID]},
    {opcode: 'cancelKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.cancelKey', default: 'cancel key [ID]', description: 'Cancel the key with the given id'}), args: {ID: 'id'}, method: 'keys.cancel', sensitive: true, confirm: formatMessage({id: 'rotur.bilupKeys.confirm.cancelKey', default: 'cancel this key', description: 'Confirmation text when cancelling a key'}), map: a => [a.ID]},
    {label: formatMessage({id: 'rotur.bilupKeys.label.manageMyKeys', default: 'Manage my keys', description: 'Section label for key management blocks'})},
    {opcode: 'renameKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.renameKey', default: 'rename key [ID] to [NAME]', description: 'Rename the key with the given id'}), args: {ID: 'id', NAME: 'name'}, method: 'keys.rename', scope: 'keys:manage', map: a => [a.ID, a.NAME]},
    {opcode: 'updateKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.updateKey', default: 'set key [ID] data to [DATA]', description: 'Set the data of the key with the given id'}), args: {ID: 'id', DATA: '{}'}, method: 'keys.update', scope: 'keys:manage', map: a => [a.ID, a.DATA]},
    {opcode: 'revokeKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.revokeKey', default: 'revoke key [ID]', description: 'Revoke the key with the given id'}), args: {ID: 'id'}, method: 'keys.revoke', scope: 'keys:manage', map: a => [a.ID]},
    {opcode: 'deleteKey', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.deleteKey', default: 'delete key [ID]', description: 'Delete the key with the given id'}), args: {ID: 'id'}, method: 'keys.delete', scope: 'keys:manage', sensitive: true, confirm: formatMessage({id: 'rotur.bilupKeys.confirm.deleteKey', default: 'delete this key', description: 'Confirmation text when deleting a key'}), map: a => [a.ID]},
    {label: formatMessage({id: 'rotur.bilupKeys.label.projectStorage', default: 'Project storage', description: 'Section label for project storage blocks'})},
    {opcode: 'saveData', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.saveData', default: 'save [VALUE] to project storage as [KEY]', description: 'Save a value to the project storage under the given key'}), args: {VALUE: '', KEY: 'key'}, storage: 'set', scope: 'storage:manage'},
    {opcode: 'loadData', blockType: R, text: formatMessage({id: 'rotur.bilupKeys.loadData', default: 'project storage [KEY]', description: 'The value stored in project storage under the given key'}), args: {KEY: 'key'}, storage: 'get', scope: 'storage:view'},
    {opcode: 'hasData', blockType: B, text: formatMessage({id: 'rotur.bilupKeys.hasData', default: 'project storage has [KEY]?', description: 'Whether project storage has a value for the given key'}), args: {KEY: 'key'}, storage: 'has', scope: 'storage:view'},
    {opcode: 'deleteData', blockType: C, text: formatMessage({id: 'rotur.bilupKeys.deleteData', default: 'delete [KEY] from project storage', description: 'Delete the given key from project storage'}), args: {KEY: 'key'}, storage: 'delete', scope: 'storage:delete'},
    {opcode: 'allDataKeys', blockType: R, text: formatMessage({id: 'rotur.bilupKeys.allDataKeys', default: 'all project storage keys', description: 'All keys stored in project storage'}), storage: 'keys', scope: 'storage:view'}
]);

const status = ext('bilupStatus', formatMessage({id: 'rotur.bilupStatus.name', default: 'Bilup Accounts Status', description: 'Extension name for the Bilup Accounts Status extension'}), [
    {opcode: 'statusOf', blockType: R, text: formatMessage({id: 'rotur.bilupStatus.statusOf', default: "[USER]'s status", description: 'The status text of the given user'}), args: {USER: 'username'}, method: 'status.get', map: a => [a.USER], result: r => (r && r.status ? r.status : '')},
    {opcode: 'presenceOf', blockType: R, text: formatMessage({id: 'rotur.bilupStatus.presenceOf', default: "[USER]'s presence", description: 'The presence state of the given user'}), args: {USER: 'username'}, method: 'status.get', map: a => [a.USER], result: r => (r && r.presence ? r.presence : '')},
    {opcode: 'fullStatusOf', blockType: R, text: formatMessage({id: 'rotur.bilupStatus.fullStatusOf', default: "[USER]'s full status", description: 'The full status object of the given user'}), args: {USER: 'username'}, method: 'status.get', map: a => [a.USER], result: r => r},
    {label: formatMessage({id: 'rotur.bilupStatus.label.myPresence', default: 'My presence', description: 'Section label for presence blocks of the current user'})},
    {opcode: 'setStatus', blockType: C, text: formatMessage({id: 'rotur.bilupStatus.setStatus', default: 'set my status to [TEXT] and presence to [PRESENCE]', description: 'Set the status text and presence of the current user'}), args: {TEXT: 'hello', PRESENCE: menu('presence', 'online')}, method: 'socket.setStatus', scope: 'account:profile', map: a => [a.TEXT, a.PRESENCE]},
    {label: formatMessage({id: 'rotur.bilupStatus.label.richPresence', default: 'Rich presence', description: 'Section label for rich presence blocks'})},
    {opcode: 'setGameActivity', blockType: C, text: formatMessage({id: 'rotur.bilupStatus.setGameActivity', default: 'show I am [VERB] this project', description: 'Show the current user is playing this project'}), args: {VERB: 'Playing'}, activity: 'set', scope: 'account:profile'},
    {opcode: 'setGameActivityFull', blockType: C, text: formatMessage({id: 'rotur.bilupStatus.setGameActivityFull', default: 'show I am [VERB] this project doing [DETAILS] with image [IMAGE]', description: 'Show the current user is playing this project with details and an image'}), args: {VERB: 'Playing', DETAILS: 'in a match', IMAGE: ''}, activity: 'set', scope: 'account:profile'},
    {opcode: 'clearActivity', blockType: C, text: formatMessage({id: 'rotur.bilupStatus.clearActivity', default: 'clear my activity', description: 'Clear the activity of the current user'}), activity: 'clear', scope: 'account:profile'}
], {
    presence: [
        {text: formatMessage({id: 'rotur.bilupStatus.menu.presence.online', default: 'online', description: 'Menu item for the online presence state'}), value: 'online'},
        {text: formatMessage({id: 'rotur.bilupStatus.menu.presence.idle', default: 'idle', description: 'Menu item for the idle presence state'}), value: 'idle'},
        {text: formatMessage({id: 'rotur.bilupStatus.menu.presence.dnd', default: 'dnd', description: 'Menu item for the do not disturb presence state'}), value: 'dnd'},
        {text: formatMessage({id: 'rotur.bilupStatus.menu.presence.invisible', default: 'invisible', description: 'Menu item for the invisible presence state'}), value: 'invisible'}
    ]
});

const social = ext('bilupSocial', formatMessage({id: 'rotur.bilupSocial.name', default: 'Bilup Accounts Social', description: 'Extension name for the Bilup Accounts Social extension'}), [
    {opcode: 'post', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.post', default: 'make a post saying [CONTENT]', description: 'Create a post with the given content'}), args: {CONTENT: 'hello world'}, method: 'posts.create', scope: 'posts:create', map: a => [a.CONTENT]},
    {opcode: 'feed', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.feed', default: 'latest posts', description: 'The latest posts'}), method: 'posts.feed', map: () => []},
    {opcode: 'followingFeed', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.followingFeed', default: 'posts from people I follow', description: 'Posts from users the current user follows'}), method: 'posts.followingFeed', scope: 'posts:view', map: () => []},
    {opcode: 'topPosts', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.topPosts', default: 'top posts', description: 'The most popular posts'}), method: 'posts.top', map: () => []},
    {opcode: 'searchPosts', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.searchPosts', default: 'search posts for [QUERY]', description: 'Search posts for the given query'}), args: {QUERY: 'hello'}, method: 'posts.search', map: a => [a.QUERY]},
    {opcode: 'like', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.like', default: 'like post [ID]', description: 'Like the post with the given id'}), args: {ID: 'id'}, method: 'posts.like', scope: 'posts:like', map: a => [a.ID]},
    {opcode: 'unlike', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.unlike', default: 'unlike post [ID]', description: 'Unlike the post with the given id'}), args: {ID: 'id'}, method: 'posts.unlike', scope: 'posts:like', map: a => [a.ID]},
    {opcode: 'reply', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.reply', default: 'reply to post [ID] saying [CONTENT]', description: 'Reply to the post with the given id'}), args: {ID: 'id', CONTENT: 'nice'}, method: 'posts.reply', scope: 'posts:reply', map: a => [a.ID, a.CONTENT]},
    {opcode: 'repost', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.repost', default: 'repost post [ID]', description: 'Repost the post with the given id'}), args: {ID: 'id'}, method: 'posts.repost', scope: 'posts:repost', map: a => [a.ID]},
    {opcode: 'deletePost', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.deletePost', default: 'delete post [ID]', description: 'Delete the post with the given id'}), args: {ID: 'id'}, method: 'posts.delete', scope: 'posts:delete', sensitive: true, confirm: formatMessage({id: 'rotur.bilupSocial.confirm.deletePost', default: 'delete this post', description: 'Confirmation text when deleting a post'}), map: a => [a.ID]},
    {label: formatMessage({id: 'rotur.bilupSocial.label.following', default: 'Following', description: 'Section label for following blocks'})},
    {opcode: 'follow', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.follow', default: 'follow [USER]', description: 'Follow the given user'}), args: {USER: 'username'}, method: 'following.follow', scope: 'following:follow', map: a => [a.USER]},
    {opcode: 'unfollow', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.unfollow', default: 'unfollow [USER]', description: 'Unfollow the given user'}), args: {USER: 'username'}, method: 'following.unfollow', scope: 'following:unfollow', map: a => [a.USER]},
    {opcode: 'followersOf', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.followersOf', default: 'followers of [USER]', description: 'Users who follow the given user'}), args: {USER: 'username'}, method: 'following.followers', map: a => [a.USER]},
    {opcode: 'followingOf', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.followingOf', default: 'who [USER] follows', description: 'Users followed by the given user'}), args: {USER: 'username'}, method: 'following.following', map: a => [a.USER]},
    {label: formatMessage({id: 'rotur.bilupSocial.label.friends', default: 'Friends', description: 'Section label for friend blocks'})},
    {opcode: 'friends', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.friends', default: 'my friends', description: 'Friends of the current user'}), method: 'friends.list', scope: 'friends:view', map: () => []},
    {opcode: 'friendRequests', blockType: R, text: formatMessage({id: 'rotur.bilupSocial.friendRequests', default: 'my incoming friend requests', description: 'Incoming friend requests for the current user'}), method: 'me.requests', scope: 'friends:view', map: () => [], result: r => JSON.stringify((r && r.requests) || [])},
    {opcode: 'requestFriend', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.requestFriend', default: 'add [USER] as a friend', description: 'Send a friend request to the given user'}), args: {USER: 'username'}, method: 'friends.request', scope: 'friends:request', map: a => [a.USER]},
    {opcode: 'acceptFriend', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.acceptFriend', default: 'accept friend request from [USER]', description: 'Accept the friend request from the given user'}), args: {USER: 'username'}, method: 'friends.accept', scope: 'friends:accept', map: a => [a.USER]},
    {opcode: 'rejectFriend', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.rejectFriend', default: 'reject friend request from [USER]', description: 'Reject the friend request from the given user'}), args: {USER: 'username'}, method: 'friends.reject', scope: 'friends:accept', map: a => [a.USER]},
    {opcode: 'removeFriend', blockType: C, text: formatMessage({id: 'rotur.bilupSocial.removeFriend', default: 'remove [USER] from my friends', description: 'Remove the given user from the friends of the current user'}), args: {USER: 'username'}, method: 'friends.remove', scope: 'friends:remove', map: a => [a.USER]}
]);

const shop = ext('bilupShop', formatMessage({id: 'rotur.bilupShop.name', default: 'Bilup Accounts Shop', description: 'Extension name for the Bilup Accounts Shop extension'}), [
    {label: formatMessage({id: 'rotur.bilupShop.label.items', default: 'Items', description: 'Section label for item blocks'})},
    {opcode: 'item', blockType: R, text: formatMessage({id: 'rotur.bilupShop.item', default: 'item [NAME]', description: 'Information about the item with the given name'}), args: {NAME: 'name'}, method: 'items.get', map: a => [a.NAME]},
    {opcode: 'itemsForSale', blockType: R, text: formatMessage({id: 'rotur.bilupShop.itemsForSale', default: 'items for sale', description: 'Items currently for sale'}), method: 'items.selling', map: () => []},
    {opcode: 'userItems', blockType: R, text: formatMessage({id: 'rotur.bilupShop.userItems', default: "[USER]'s items", description: 'Items owned by the given user'}), args: {USER: 'username'}, method: 'items.list', map: a => [a.USER]},
    {opcode: 'buyItem', blockType: C, text: formatMessage({id: 'rotur.bilupShop.buyItem', default: 'buy item [NAME]', description: 'Buy the item with the given name'}), args: {NAME: 'name'}, method: 'items.buy', scope: 'items:buy', sensitive: true, confirm: formatMessage({id: 'rotur.bilupShop.confirm.buyItem', default: 'buy this item', description: 'Confirmation text when buying an item'}), map: a => [a.NAME]},
    {opcode: 'sellItem', blockType: C, text: formatMessage({id: 'rotur.bilupShop.sellItem', default: 'put item [NAME] up for sale', description: 'Put the item with the given name up for sale'}), args: {NAME: 'name'}, method: 'items.sell', scope: 'items:sell', map: a => [a.NAME]},
    {opcode: 'stopSelling', blockType: C, text: formatMessage({id: 'rotur.bilupShop.stopSelling', default: 'stop selling item [NAME]', description: 'Stop selling the item with the given name'}), args: {NAME: 'name'}, method: 'items.stopSelling', scope: 'items:sell', map: a => [a.NAME]},
    {opcode: 'setItemPrice', blockType: C, text: formatMessage({id: 'rotur.bilupShop.setItemPrice', default: 'set price of item [NAME] to [PRICE]', description: 'Set the price of the item with the given name'}), args: {NAME: 'name', PRICE: num(1)}, method: 'items.setPrice', scope: 'items:sell', map: a => [a.NAME, Number(a.PRICE) || 0]},
    {opcode: 'giveItem', blockType: C, text: formatMessage({id: 'rotur.bilupShop.giveItem', default: 'give item [NAME] to [USER]', description: 'Give the item with the given name to the given user'}), args: {NAME: 'name', USER: 'username'}, method: 'items.transfer', scope: 'items:manage', sensitive: true, confirm: formatMessage({id: 'rotur.bilupShop.confirm.giveItem', default: 'give away this item', description: 'Confirmation text when giving away an item'}), map: a => [a.NAME, a.USER]},
    {label: formatMessage({id: 'rotur.bilupShop.label.cosmetics', default: 'Cosmetics', description: 'Section label for cosmetic blocks'})},
    {opcode: 'cosmeticShop', blockType: R, text: formatMessage({id: 'rotur.bilupShop.cosmeticShop', default: 'cosmetics shop', description: 'Cosmetics available in the shop'}), method: 'cosmetics.shop', map: () => []},
    {opcode: 'myCosmetics', blockType: R, text: formatMessage({id: 'rotur.bilupShop.myCosmetics', default: 'my cosmetics', description: 'Cosmetics owned by the current user'}), method: 'cosmetics.mine', scope: 'cosmetics:view', map: () => []},
    {opcode: 'buyCosmetic', blockType: C, text: formatMessage({id: 'rotur.bilupShop.buyCosmetic', default: 'buy cosmetic [ID]', description: 'Buy the cosmetic with the given id'}), args: {ID: 'id'}, method: 'cosmetics.purchase', scope: 'cosmetics:buy', sensitive: true, confirm: formatMessage({id: 'rotur.bilupShop.confirm.buyCosmetic', default: 'buy this cosmetic', description: 'Confirmation text when buying a cosmetic'}), map: a => [a.ID]},
    {opcode: 'equipCosmetic', blockType: C, text: formatMessage({id: 'rotur.bilupShop.equipCosmetic', default: 'equip cosmetic [ID]', description: 'Equip the cosmetic with the given id'}), args: {ID: 'id'}, method: 'cosmetics.equip', scope: 'cosmetics:equip', map: a => [a.ID]},
    {opcode: 'unequipCosmetic', blockType: C, text: formatMessage({id: 'rotur.bilupShop.unequipCosmetic', default: 'unequip cosmetic type [TYPE]', description: 'Unequip the cosmetic type'}), args: {TYPE: 'hat'}, method: 'cosmetics.unequip', scope: 'cosmetics:equip', map: a => [a.TYPE]},
    {opcode: 'cosmeticsOf', blockType: R, text: formatMessage({id: 'rotur.bilupShop.cosmeticsOf', default: "[USER]'s cosmetics", description: 'Cosmetics owned by the given user'}), args: {USER: 'username'}, method: 'cosmetics.forUser', map: a => [a.USER]}
]);

const groups = ext('bilupGroups', formatMessage({id: 'rotur.bilupGroups.name', default: 'Bilup Accounts Groups', description: 'Extension name for the Bilup Accounts Groups extension'}), [
    {opcode: 'myGroups', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.myGroups', default: 'groups I am in', description: 'Groups the current user is a member of'}), method: 'groups.mine', scope: 'groups:view', map: () => []},
    {opcode: 'searchGroups', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.searchGroups', default: 'search groups for [QUERY]', description: 'Search groups for the given query'}), args: {QUERY: 'name'}, method: 'groups.search', scope: 'groups:view', map: a => [a.QUERY]},
    {opcode: 'group', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.group', default: 'group [TAG]', description: 'Information about the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.get', map: a => [a.TAG]},
    {opcode: 'joinGroup', blockType: C, text: formatMessage({id: 'rotur.bilupGroups.joinGroup', default: 'join group [TAG]', description: 'Join the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.join', scope: 'groups:join', map: a => [a.TAG]},
    {opcode: 'requestJoinGroup', blockType: C, text: formatMessage({id: 'rotur.bilupGroups.requestJoinGroup', default: 'request to join group [TAG]', description: 'Request to join the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.requestJoin', scope: 'groups:join', map: a => [a.TAG]},
    {opcode: 'leaveGroup', blockType: C, text: formatMessage({id: 'rotur.bilupGroups.leaveGroup', default: 'leave group [TAG]', description: 'Leave the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.leave', scope: 'groups:leave', map: a => [a.TAG]},
    {label: formatMessage({id: 'rotur.bilupGroups.label.groupInfo', default: 'Group info', description: 'Section label for group information blocks'})},
    {opcode: 'groupMembers', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.groupMembers', default: 'members of group [TAG]', description: 'Members of the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.members', scope: 'groups:members.view', map: a => [a.TAG]},
    {opcode: 'groupRoles', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.groupRoles', default: 'roles in group [TAG]', description: 'Roles in the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.roles', scope: 'groups:view', map: a => [a.TAG]},
    {opcode: 'groupAnnouncements', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.groupAnnouncements', default: 'announcements in group [TAG]', description: 'Announcements in the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.announcements', map: a => [a.TAG]},
    {opcode: 'groupEvents', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.groupEvents', default: 'events in group [TAG]', description: 'Events in the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.events', scope: 'groups:view', map: a => [a.TAG]},
    {label: formatMessage({id: 'rotur.bilupGroups.label.groupEconomy', default: 'Group economy', description: 'Section label for group economy blocks'})},
    {opcode: 'groupProducts', blockType: R, text: formatMessage({id: 'rotur.bilupGroups.groupProducts', default: 'products in group [TAG]', description: 'Products in the group with the given tag'}), args: {TAG: 'tag'}, method: 'groups.products', scope: 'groups:view', map: a => [a.TAG]},
    {opcode: 'tipGroup', blockType: C, text: formatMessage({id: 'rotur.bilupGroups.tipGroup', default: 'tip [AMOUNT] credits to group [TAG]', description: 'Send a tip of credits to the group with the given tag'}), args: {AMOUNT: num(1), TAG: 'tag'}, method: 'groups.sendTip', scope: 'credits:manage', sensitive: true, confirm: formatMessage({id: 'rotur.bilupGroups.confirm.tipGroup', default: 'tip this group', description: 'Confirmation text when tipping a group'}), map: a => [a.TAG, Number(a.AMOUNT) || 0]},
    {opcode: 'buyGroupProduct', blockType: C, text: formatMessage({id: 'rotur.bilupGroups.buyGroupProduct', default: 'buy product [PRODUCT] in group [TAG]', description: 'Buy the given product in the group with the given tag'}), args: {PRODUCT: 'id', TAG: 'tag'}, method: 'groups.purchaseProduct', scope: 'credits:manage', sensitive: true, confirm: formatMessage({id: 'rotur.bilupGroups.confirm.buyGroupProduct', default: 'buy this product', description: 'Confirmation text when buying a group product'}), map: a => [a.TAG, a.PRODUCT]}
]);

const files = ext('bilupFiles', formatMessage({id: 'rotur.bilupFiles.name', default: 'Bilup Accounts Files', description: 'Extension name for the Bilup Accounts Files extension'}), [
    {opcode: 'myFiles', blockType: R, text: formatMessage({id: 'rotur.bilupFiles.myFiles', default: 'my files', description: 'Files owned by the current user'}), method: 'files.index', scope: 'files:view', map: () => []},
    {opcode: 'fileAtPath', blockType: R, text: formatMessage({id: 'rotur.bilupFiles.fileAtPath', default: 'file at path [PATH]', description: 'The file located at the given path'}), args: {PATH: '/file.txt'}, method: 'files.getByPath', scope: 'files:view', map: a => [a.PATH]},
    {opcode: 'fileById', blockType: R, text: formatMessage({id: 'rotur.bilupFiles.fileById', default: 'file with id [UUID]', description: 'The file with the given id'}), args: {UUID: 'uuid'}, method: 'files.getByUUID', scope: 'files:view', map: a => [a.UUID]},
    {opcode: 'storageUsage', blockType: R, text: formatMessage({id: 'rotur.bilupFiles.storageUsage', default: 'my storage usage', description: 'Storage usage of the current user'}), method: 'files.usage', scope: 'files:view', map: () => []}
]);

module.exports = {
    RoturAccount: account,
    RoturEconomy: economy,
    RoturKeys: keys,
    RoturStatus: status,
    RoturSocial: social,
    RoturShop: shop,
    RoturGroups: groups,
    RoturFiles: files
};
