interface ProviderRequestArgs {
    method: string;
    params?: unknown;
}

export interface EthereumProvider {
    request: (args: ProviderRequestArgs) => Promise<unknown>;
}

export function wrapProviderWithSnapsBypass(provider: EthereumProvider): EthereumProvider {
    if (!provider || !provider.request) return provider;
    const originalRequest = provider.request.bind(provider);
    return {
        ...provider,
        request: async (args: ProviderRequestArgs) => {
            if (args.method === "wallet_getSnaps" || 
                args.method === "wallet_requestSnaps" ||
                args.method === "wallet_invokeSnap") {
                return {};
            }
            return originalRequest(args);
        },
    };
}
