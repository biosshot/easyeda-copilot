import { isEasyEda } from "./utils";

export const getUserInfo = () => {
    if (!isEasyEda()) return null;
    const info = eda.sys_Environment.getUserInfo();
    return {
        ...info,
        avatar: info.avatar?.startsWith('//') ? `https:${info.avatar}` : info.avatar
    }
}

export const getUserAuth = () => {
    const encode = (payload: unknown) => btoa(JSON.stringify(payload));

    if (!isEasyEda()) return encode({
        username: 'test',
        uuid: 'test'
    });

    const userInfo = getUserInfo();

    return encode({
        username: userInfo?.username,
        uuid: userInfo?.uuid
    });
}

