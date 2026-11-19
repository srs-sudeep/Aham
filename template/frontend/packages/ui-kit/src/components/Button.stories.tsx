import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../primitives/button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "destructive"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Outline: Story = { args: { variant: "outline" } };

export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } };

export const Disabled: Story = { args: { disabled: true } };
