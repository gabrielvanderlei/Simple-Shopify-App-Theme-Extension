import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

// GET - Buscar configurações
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    let shopConfig = null;
    
    try {
      shopConfig = await prisma.shopConfiguration.findUnique({
        where: { shop: session.shop }
      });
    } catch (dbError) {
      console.log("Database not ready, using defaults");
    }

    return json({
      success: true,
      config: shopConfig || {
        shop: session.shop,
        openaiApiKey: "",
        chatEnabled: false,
        maxTokens: 1000,
        temperature: 0.7,
      }
    });
  } catch (error) {
    console.error("Config loader error:", error);
    return json({ 
      success: false, 
      error: "Failed to load configuration",
      config: {
        shop: "unknown",
        openaiApiKey: "",
        chatEnabled: false,
        maxTokens: 1000,
        temperature: 0.7,
      }
    }, { status: 500 });
  }
};

// POST - Salvar configurações
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const data = await request.json();
    
    const { openaiApiKey, chatEnabled, maxTokens, temperature } = data;

    const updatedConfig = await prisma.shopConfiguration.upsert({
      where: { shop: session.shop },
      update: {
        openaiApiKey,
        chatEnabled,
        maxTokens,
        temperature,
        updatedAt: new Date(),
      },
      create: {
        shop: session.shop,
        openaiApiKey,
        chatEnabled,
        maxTokens,
        temperature,
      },
    });

    return json({
      success: true,
      message: "Configuration saved successfully!",
      config: updatedConfig
    });
  } catch (error) {
    console.error("Config save error:", error);
    return json({ 
      success: false, 
      error: "Failed to save configuration" 
    }, { status: 500 });
  }
};