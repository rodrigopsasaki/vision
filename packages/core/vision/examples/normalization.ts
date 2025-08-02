import { vision } from "../src/index";

// Example demonstrating the key normalization feature

function runExample() {
  console.log("=== Vision Key Normalization Demo ===\n");

  // Initialize Vision with snake_case normalization
  vision.init({
    normalization: {
      enabled: true,
      keyCasing: "snake_case",
      deep: true,
    },
  });

  console.log("🔧 Initialized Vision with snake_case normalization\n");

  // Example 1: Basic key transformation
  console.log("📝 Example 1: Basic key transformation");
  vision.observe("user.registration", async () => {
    // User adds data with various casing styles
    vision.set("userId", "user123");
    vision.set("firstName", "John");
    vision.set("lastName", "Doe");
    vision.set("isActive", true);
    vision.set("lastLoginAt", "2023-01-01T00:00:00Z");

    console.log("   ↳ Set keys: userId, firstName, lastName, isActive, lastLoginAt");
    console.log(
      "   ↳ Exporters will receive: user_id, first_name, last_name, is_active, last_login_at",
    );
  });

  console.log();

  // Example 2: Nested object normalization
  console.log("📝 Example 2: Nested object normalization");
  vision.observe("user.profile.update", async () => {
    vision.set("userProfile", {
      personalInfo: {
        firstName: "Jane",
        lastName: "Smith",
        birthDate: "1990-01-15",
      },
      contactDetails: {
        emailAddress: "jane@example.com",
        phoneNumber: "+1-555-1234",
        homeAddress: {
          streetName: "Main St",
          cityName: "Boston",
          zipCode: "02101",
        },
      },
      preferences: {
        emailNotifications: true,
        darkMode: false,
        language: "en-US",
      },
    });

    console.log("   ↳ Set nested object with camelCase keys");
    console.log("   ↳ All nested keys will be converted to snake_case");
  });

  console.log();

  // Example 3: Arrays and mixed data types
  console.log("📝 Example 3: Arrays and mixed data types");
  vision.observe("order.processing", async () => {
    vision.push("orderItems", {
      productId: "prod-123",
      productName: "Widget",
      unitPrice: 29.99,
      quantity: 2,
    });

    vision.push("orderItems", {
      productId: "prod-456",
      productName: "Gadget",
      unitPrice: 19.99,
      quantity: 1,
    });

    vision.merge("orderMetadata", {
      orderId: "order-789",
      customerId: "customer-456",
      orderDate: new Date().toISOString(),
      shippingAddress: {
        streetName: "Oak Avenue",
        cityName: "New York",
        stateCode: "NY",
      },
    });

    console.log("   ↳ Added array items and merged metadata");
    console.log("   ↳ Keys in arrays and merged objects will be normalized");
  });

  console.log();

  // Example 4: Different casing styles
  console.log("📝 Example 4: Different casing styles");

  // Switch to camelCase
  vision.init({
    normalization: {
      enabled: true,
      keyCasing: "camelCase",
      deep: true,
    },
  });

  vision.observe("api.response", async () => {
    vision.set("response_data", {
      user_id: "123",
      first_name: "Bob",
      last_name: "Wilson",
      account_settings: {
        email_notifications: true,
        two_factor_enabled: false,
      },
    });

    console.log("   ↳ Input with snake_case keys");
    console.log("   ↳ Will be normalized to camelCase");
  });

  console.log();

  // Example 5: Disabled normalization
  console.log("📝 Example 5: Disabled normalization");
  vision.init({
    normalization: {
      enabled: false,
      keyCasing: "none",
      deep: true,
    },
  });

  vision.observe("legacy.system", async () => {
    vision.set("mixed_CaseKeys", "value1");
    vision.set("another-key", "value2");
    vision.set("YetAnotherKey", "value3");

    console.log("   ↳ Mixed casing keys will remain unchanged");
    console.log("   ↳ Normalization is disabled");
  });

  console.log("\n✅ Demo completed! Check the console output above to see the normalized keys.\n");
}

// Run the example
runExample();
