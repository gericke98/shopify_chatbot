"use client";

import {
  Card,
  Page,
  Layout,
  TextContainer,
  Text,
  Button,
} from "@shopify/polaris";
import { useState } from "react";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Implement your settings save logic here
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated API call
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Page
      title="App Settings"
      backAction={{
        content: "Back",
        onAction: () => window.history.back(),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-4">
              <TextContainer>
                <Text variant="headingMd" as="h2">
                  Chatbot Configuration
                </Text>
                <Text as="p" variant="bodyMd">
                  Configure your chatbot settings here.
                </Text>
              </TextContainer>
              <div className="mt-4">
                <Button
                  variant="primary"
                  loading={isLoading}
                  onClick={handleSave}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
