"use client";

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";

interface PortalHeaderActionsProps {
  customer: {
    full_name: string;
    customer_code: string;
  };
}

export function PortalHeaderActions({ customer }: PortalHeaderActionsProps) {
  const [showPwModal, setShowPwModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Identity Pill */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#0B1B3D] bg-[#FAF9F6] border border-[#EAE7E0] rounded-full px-2.5 sm:px-3 py-1.5">
          <span className="w-6 h-6 rounded-full bg-[#EBF5F1] text-[#0F4C3A] flex items-center justify-center font-bold text-xs flex-shrink-0">
            {customer.full_name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline font-semibold">{customer.full_name}</span>
        </div>

        {/* Change Password Button */}
        <button
          type="button"
          onClick={() => setShowPwModal(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1B3D] hover:text-[#0F4C3A] bg-white border border-[#EAE7E0] hover:border-[#D6D2C7] px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          title="Change your account password"
        >
          <KeyRound className="w-3.5 h-3.5 text-[#B89047]" />
          <span className="hidden md:inline">Password</span>
        </button>

        {/* Sign Out Button */}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0B1B3D] border border-[#EAE7E0] hover:border-[#D6D2C7] bg-white rounded-lg px-2.5 sm:px-3 py-1.5 transition-colors cursor-pointer"
            style={{ minHeight: 44 }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>

      {/* Reusable Direct Server Password Update Modal */}
      <ChangePasswordModal
        isOpen={showPwModal}
        onClose={() => setShowPwModal(false)}
        userEmail={`Customer (${customer.customer_code})`}
      />
    </>
  );
}
