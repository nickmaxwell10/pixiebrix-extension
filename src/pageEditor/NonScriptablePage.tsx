/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import styles from "./NonScriptablePage.module.scss";

import React from "react";
import { Col, Row, Container } from "react-bootstrap";
import workshopImage from "@img/workshop.svg";

const GetStarted: React.FunctionComponent = () => (
  <>
    <h4 className={styles.callout}>Get started with PixieBrix</h4>
    <p>
      This is the PixieBrix Page Editor. Use the Page Editor to create web page
      modifications, called mods.
    </p>
    <p>
      To start, navigate to a web page that you&apos;d like to modify and then
      click the &quot;Add&quot; button.
    </p>
  </>
);

const NeedHelp: React.FunctionComponent = () => (
  <div>
    <h4 className={styles.tinyCallout}>Need more help?</h4>
    <p>
      Visit the{" "}
      <a
        href="https://docs.pixiebrix.com/quick-start"
        target="_blank"
        rel="noopener noreferrer"
      >
        Quick Start Guide
      </a>{" "}
      or ask questions in the{" "}
      <a
        href="https://pixiebrixcommunity.slack.com/join/shared_invite/zt-13gmwdijb-Q5nVsSx5wRLmRwL3~lsDww#/shared-invite/email"
        target="_blank"
        rel="noopener noreferrer"
      >
        Slack Community
      </a>
      .{" "}
    </p>
  </div>
);

const NonScriptablePage: React.FunctionComponent<{ url: string }> = ({
  url,
}) => (
  <Container fluid className={styles.root}>
    <div className="my-auto">
      <Row className={styles.paneRow}>
        <Col lg={9}>
          <GetStarted />
        </Col>

        <Col
          lg={3}
          className="d-flex align-items-center justify-content-center"
        >
          <img
            className={styles.illustration}
            src={workshopImage}
            alt=""
            width="100%"
          />
        </Col>
      </Row>
      <Row className={styles.paneRowWithDivider}>
        <Col lg={9}>
          <NeedHelp />
        </Col>
      </Row>
    </div>
  </Container>
);

export default NonScriptablePage;
