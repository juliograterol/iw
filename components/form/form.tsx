"use client";

import { Label } from "flowbite-react";
import React, { useEffect, useState } from "react";
import { sendMail, formData } from "../lib/utils";
import professionalOptions from "./professionalOptions";
import Input from "./input";
import Select from "./select";
import Textarea from "./textarea";
import FadeInContent from "../FadeInContent";
import SplitText from "../text-animation/SplitText";
import FormButton from "../buttons/form-buttons";
import Loader from "../loader";
import Checkbox from "./checkbox";
import { useScrollIntoView } from "@/lib/use-scroll-into-view";
import { useIsMobile } from "@/lib/useMobile";
import { TransitionLink } from "../link";
import { footerNavbar, navbar } from "@/app/content/navbar";
import Socials from "../footer/socials";
import Image from "next/image";
import { FooterList } from "../footer/footer-list";
import { Toast, useToast } from "./toast";
import {
  collectFieldErrors,
  FieldRule,
  FieldTip,
  useFieldErrors,
} from "./validation";

const REQUIRED_FIELDS: FieldRule[] = [
  { id: "firstname", label: "First name" },
  { id: "lastname", label: "Last name" },
  { id: "company", label: "Company name" },
  { id: "phone", label: "Phone number" },
  { id: "email", label: "Email" },
  { id: "size", label: "Company size" },
  { id: "staff", label: "Number of staff required" },
  { id: "country", label: "Country" },
  { id: "message", label: "Message" },
];

type CountryOption = { name: string; iso: string; dial: string };

// Used while the list loads, or if it can't be fetched.
const FALLBACK_COUNTRIES: CountryOption[] = [
  { name: "Australia", iso: "AU", dial: "+61" },
  { name: "Canada", iso: "CA", dial: "+1" },
  { name: "France", iso: "FR", dial: "+33" },
  { name: "Germany", iso: "DE", dial: "+49" },
  { name: "India", iso: "IN", dial: "+91" },
  { name: "Mexico", iso: "MX", dial: "+52" },
  { name: "Philippines", iso: "PH", dial: "+63" },
  { name: "Spain", iso: "ES", dial: "+34" },
  { name: "United Kingdom", iso: "GB", dial: "+44" },
  { name: "United States", iso: "US", dial: "+1" },
];

const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=name,cca2,idd";
const GEO_URL = "https://ipapi.co/json/";

type RestCountry = {
  name: { common: string };
  cca2: string;
  idd?: { root?: string; suffixes?: string[] };
};

const toCountryOption = (c: RestCountry): CountryOption | null => {
  const root = c.idd?.root;
  if (!root) return null;
  const suffixes = c.idd?.suffixes ?? [];
  // Countries that share a root (e.g. +1) use the root alone.
  const dial = suffixes.length === 1 ? root + suffixes[0] : root;
  return { name: c.name.common, iso: c.cca2, dial };
};

/** Phone value in international format: dial code + digits, no trunk "0". */
const toInternationalPhone = (dial: string, raw: string) => {
  const value = raw.trim();
  if (value.startsWith("+")) return `+${value.replace(/\D/g, "")}`;
  return `${dial}${value.replace(/\D/g, "").replace(/^0+/, "")}`;
};

const MainForm = ({
  heading = "Speak with our team today!",
  socials = true,
}: {
  heading?: string | React.ReactNode | false;
  socials?: boolean;
}) => {
  const [sending, isSending] = useState(false);
  const [sent, isSent] = useState(false);
  const [professionals, setProfessionals] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const { toast, show, dismiss } = useToast();
  const validation = useFieldErrors();
  const [countries, setCountries] =
    useState<CountryOption[]>(FALLBACK_COUNTRIES);
  const [countriesStatus, setCountriesStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [country, setCountry] = useState("");
  const [dialIso, setDialIso] = useState("US");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const load = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`${url} responded ${res.status}`);
      return res.json();
    };

    (async () => {
      const [list, geo] = await Promise.allSettled([
        load<RestCountry[]>(COUNTRIES_URL),
        load<{ country_code?: string }>(GEO_URL),
      ]);
      clearTimeout(timeout);

      let options = FALLBACK_COUNTRIES;
      if (list.status === "fulfilled" && Array.isArray(list.value)) {
        const parsed = list.value
          .map(toCountryOption)
          .filter((c): c is CountryOption => c !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
        if (parsed.length > 0) options = parsed;
      }
      setCountries(options);
      setCountriesStatus(options === FALLBACK_COUNTRIES ? "failed" : "ready");

      // Best-effort: preselect the visitor's location, never overriding input.
      if (geo.status === "fulfilled") {
        const iso = geo.value?.country_code?.toUpperCase();
        const match = options.find((c) => c.iso === iso);
        if (match) {
          setCountry((prev) => prev || match.name);
          setDialIso(match.iso);
        }
      }
    })().catch(() => setCountriesStatus("failed"));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;

    const errors = collectFieldErrors(form, REQUIRED_FIELDS);
    if (professionals.length === 0) {
      errors.professional = "Please select at least one professional";
    }
    if (!(form.elements.namedItem("agree") as HTMLInputElement).checked) {
      errors.agree = "Please accept the Privacy Policy";
    }
    if (Object.keys(errors).length > 0) {
      validation.flag(errors);
      show(
        "error",
        "Some required information is missing. Please check the highlighted fields.",
      );
      return;
    }

    isSending(true);

    const formData = new FormData(form);

    const data: formData = {
      fullName:
        `${formData.get("firstname") ?? ""} ${formData.get("lastname") ?? ""}`.trim(),
      company: String(formData.get("company") ?? ""),
      phone: toInternationalPhone(
        countries.find((c) => c.iso === dialIso)?.dial ?? "",
        String(formData.get("phoneNumber") ?? ""),
      ),
      email: String(formData.get("email") ?? ""),
      size: String(formData.get("size") ?? ""),
      staff: String(formData.get("staff") ?? ""),
      country: String(formData.get("country") ?? ""),
      professional: String(formData.get("professional") ?? ""),
      message: String(formData.get("message") ?? ""),
    };

    let completed = false;
    try {
      completed = await sendMail(data);
    } catch (error) {
      console.error(error);
    }

    isSending(false);

    if (completed) {
      isSent(true);

      setTimeout(() => isSent(false), 5000);

      form.reset();
      setCountry("");
      setProfessionals([]);
      validation.clear();
      show("success", "Thank you! Your message has been sent.");
    } else {
      show(
        "error",
        "There was a problem to contact us. Please try again later.",
      );
    }
  };

  const { ref } = useScrollIntoView<HTMLFormElement>();
  return (
    <FadeInContent>
      <form
        ref={ref}
        className="md:grid md:grid-cols-[2fr_1fr] gap-x-6 flex flex-col"
        onSubmit={handleSubmit}
        onChange={validation.handleChange}
        noValidate
        name="Contact Form"
      >
        <Toast toast={toast} onDismiss={dismiss} />
        <div>
          {heading && (
            <SplitText
              className={`text-4xl md:text-6xl font-medium py-10 text-iw-red-2`}
              textAlign="start"
              text={heading}
            />
          )}
          <div className="md:grid md:grid-cols-2 gap-x-3">
            <FieldTip {...validation.tip("firstname")}>
              <Input
                id="firstname"
                name="firstname"
                type="text"
                placeholder="First name"
                autoComplete="given-name"
                required
                {...validation.describe("firstname")}
              />
            </FieldTip>
            <FieldTip {...validation.tip("lastname")}>
              <Input
                id="lastname"
                name="lastname"
                type="text"
                placeholder="Last name"
                autoComplete="family-name"
                required
                {...validation.describe("lastname")}
              />
            </FieldTip>
            <FieldTip {...validation.tip("company")} className="col-span-2">
              <Input
                id="company"
                name="company"
                type="text"
                placeholder="Company's Name"
                autoComplete="organization"
                required
                {...validation.describe("company")}
              />
            </FieldTip>
            <FieldTip {...validation.tip("phone")}>
              <div className="flex items-end gap-3">
                <div className="w-28 shrink-0">
                  <Select
                    id="dialCode"
                    aria-label="Country calling code"
                    placeholder="Code"
                    value={dialIso}
                    onChange={setDialIso}
                  >
                    {countries.map((c) => (
                      <option key={c.iso} value={c.iso}>
                        {`${c.name} ${c.dial}`}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  id="phone"
                  name="phoneNumber"
                  type="tel"
                  className="flex-1"
                  placeholder="Phone Number"
                  autoComplete="tel-national"
                  pattern="[+0-9\s\-().]{5,}"
                  required
                  {...validation.describe("phone")}
                />
              </div>
            </FieldTip>
            <FieldTip {...validation.tip("email")}>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                {...validation.describe("email")}
              />
            </FieldTip>
            <FieldTip {...validation.tip("size")} className="col-span-2">
              <Input
                id="size"
                name="size"
                type="number"
                placeholder="Your company size (current staff number)"
                autoComplete="off"
                required
                {...validation.describe("size")}
              />
            </FieldTip>
            <div className="md:grid md:grid-cols-2 flex flex-col gap-6 md:col-span-2 items-end">
              <FieldTip {...validation.tip("staff")}>
                <Input
                  id="staff"
                  name="staff"
                  type="number"
                  placeholder="Number of Staff Required?"
                  autoComplete="off"
                  required
                  {...validation.describe("staff")}
                />
              </FieldTip>
              <FieldTip {...validation.tip("country")}>
                <Select
                  id="country"
                  placeholder="Which country are you based in?"
                  required
                  value={country}
                  onChange={(selected) => {
                    setCountry(selected);
                    validation.touch("country", selected !== "");
                  }}
                  aria-busy={countriesStatus === "loading"}
                  {...validation.describe("country")}
                >
                  {countries.map((c) => (
                    <option key={c.iso} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <span role="status" className="sr-only">
                  {countriesStatus === "loading" && "Loading countries"}
                  {countriesStatus === "failed" &&
                    "Could not load the full country list. Showing a short list instead."}
                </span>
              </FieldTip>
            </div>
          </div>
        </div>
        <div className="relative max-md:hidden w-full h-full">
          {socials ? (
            <div className="flex flex-col items-end gap-6 justify-start absolute py-10 top-0 right-0 w-max h-full gap-x-6">
              <FooterList
                items={footerNavbar.map((item, i) => (
                  <TransitionLink
                    key={`item-${i}`}
                    href={item.link}
                    className="relative after:absolute after:left-1/2 after:top-full after:w-0 after:h-px after:bg-current
                    hover:after:left-0 hover:after:w-full after:transition-all after:duration-150 active:text-iw-red-3 flex w-full justify-center"
                  >
                    {item.title}
                  </TransitionLink>
                ))}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0 pointer-events-none select-none"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
              }}
            >
              <Image
                width={1080}
                height={1080}
                alt="InteractiveWorker"
                src={"/team-2026/GABRIEL/gabriel_01.png"}
                className="object-top object-cover w-full h-full"
              />
            </div>
          )}
        </div>
        <h3 className="font-medium md:text-2xl text-xl mt-4 md:col-span-2 text-iw-red-2">
          Choose your Professional
        </h3>
        <div className="grid md:grid-cols-3 gap-3 md:col-span-2">
          <FieldTip {...validation.tip("professional")}>
            <Select
              id="professional"
              required
              multiple
              value={professionals}
              onChange={(selected) => {
                setProfessionals(selected);
                validation.touch("professional", selected.length > 0);
              }}
              {...validation.describe("professional")}
            >
              {professionalOptions.map((option, index) => (
                <option key={index}>{option}</option>
              ))}
            </Select>
          </FieldTip>
          <FieldTip {...validation.tip("message")} className="md:col-span-2">
            <Textarea
              id="message"
              name="message"
              placeholder="What's your question? Or what kind of outsourcing help do you need?"
              autoComplete="off"
              required
              rows={isMobile ? 2 : 1}
              {...validation.describe("message")}
            />
          </FieldTip>
        </div>
        <div className="md:col-span-2 grid md:grid-cols-[auto_auto] grid-cols-1 gap-3 py-4">
          <p className="max-md:text-xs max-md:text-center">
            Messages and data rates may apply.
            <br className="md:hidden" /> (Message frequency will vary).
            <br /> Reply STOP to opt-out of messaging.
          </p>
          <div className="flex flex-col md:items-end">
            <div className="md:w-max w-full">
              <FieldTip {...validation.tip("agree")} align="end">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="agree"
                    name="agree"
                    required
                    {...validation.describe("agree")}
                  />

                  <Label htmlFor="agree" className="flex">
                    <span className="flex text-black">
                      I agree with the&nbsp;
                      <TransitionLink
                        href="/policy"
                        className="text-iw-red-1 hover:underline"
                      >
                        Privacy Policy
                      </TransitionLink>
                    </span>
                  </Label>
                </div>
              </FieldTip>
              <FormButton
                className="mt-3 flex justify-center w-full uppercase [--primary-color:#dd272d]"
                disabled={sending || validation.locked}
              >
                {sending
                  ? "Sending..."
                  : // <Loader className="min-w-[2.25rem] min-h-[2.25rem] px-10" />
                    !sent
                    ? "Send mail"
                    : "Sent"}
              </FormButton>
            </div>
          </div>
        </div>
      </form>
    </FadeInContent>
  );
};

export default MainForm;
